use ajudafinancas_lib::shared::card_bills::billing_period;
use ajudafinancas_lib::shared::util::month_range;
use chrono::NaiveDate;

#[test]
fn billing_period_respeita_fechamento_e_clamp() {
    let ref_month = NaiveDate::from_ymd_opt(2026, 3, 1).unwrap();
    let (s, e) = billing_period(10, ref_month);
    assert_eq!(s, NaiveDate::from_ymd_opt(2026, 2, 10).unwrap());
    assert_eq!(e, NaiveDate::from_ymd_opt(2026, 3, 10).unwrap());

    // dia 31 clampado: fev só tem 28, abr 30
    let (s2, e2) = billing_period(31, NaiveDate::from_ymd_opt(2026, 4, 1).unwrap());
    assert_eq!(s2, NaiveDate::from_ymd_opt(2026, 3, 31).unwrap());
    assert_eq!(e2, NaiveDate::from_ymd_opt(2026, 4, 30).unwrap());
}

#[test]
fn month_range_gera_inicio_e_fim() {
    let (s, e) = month_range("2026-01").unwrap();
    assert_eq!(s, NaiveDate::from_ymd_opt(2026, 1, 1).unwrap());
    assert_eq!(e, NaiveDate::from_ymd_opt(2026, 2, 1).unwrap());
    assert!(month_range("abc").is_err());
}

use ajudafinancas_lib::db::migrations;
use ajudafinancas_lib::domain;
use ajudafinancas_lib::shared::report;
use rusqlite::Connection;

fn conn() -> Connection {
    let mut c = Connection::open_in_memory().unwrap();
    migrations().to_latest(&mut c).unwrap();
    c
}

#[test]
fn gera_conta_fixa_no_dia_clampado_e_nao_duplica() {
    let c = conn();
    c.execute(
        "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
         VALUES ('Aluguel', 150000, 30, 1, '2025-01', NULL, NULL)",
        [],
    )
    .unwrap();
    let feb = chrono::NaiveDate::from_ymd_opt(2026, 2, 1).unwrap();
    domain::generate_fixed_bills(&c, feb).unwrap();

    let n: i64 = c
        .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
        .unwrap();
    assert_eq!(n, 1);
    let (date, amount): (String, i64) = c
        .query_row("SELECT date, amount FROM transactions LIMIT 1", [], |r| Ok((r.get(0)?, r.get(1)?)))
        .unwrap();
    assert_eq!(date, "2026-02-28", "dia 30 clampado para fevereiro");
    assert_eq!(amount, 150000);

    // rodar de novo no mesmo mês não duplica
    domain::generate_fixed_bills(&c, feb).unwrap();
    let n2: i64 = c
        .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
        .unwrap();
    assert_eq!(n2, 1);
}

#[test]
fn ignora_conta_fixa_fora_do_periodo() {
    let c = conn();
    c.execute(
        "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
         VALUES ('Antiga', 100, 1, 1, '2020-01', '2020-06', NULL)",
        [],
    )
    .unwrap();
    let m = chrono::NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
    domain::generate_fixed_bills(&c, m).unwrap();
    let n: i64 = c
        .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
        .unwrap();
    assert_eq!(n, 0);
}

#[test]
fn gera_parcelas_de_emprestimo() {
    let c = conn();
    c.execute(
        "INSERT INTO loans (type, description, principal, installment, total_installments, day, start_month, payment_method_id)
         VALUES (1, 'Empréstimo', 300000, 110000, 3, 15, '2026-01', 1)",
        [],
    )
    .unwrap();

    // mês 1: entrada (receita) + 1ª parcela (despesa)
    domain::generate_loan_installments(&c, chrono::NaiveDate::from_ymd_opt(2026, 1, 1).unwrap()).unwrap();
    let (income, expense): (i64, i64) = c
        .query_row(
            "SELECT SUM(CASE WHEN type=1 THEN 1 ELSE 0 END), SUM(CASE WHEN type=2 THEN 1 ELSE 0 END) FROM transactions",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!((income, expense), (1, 1));
    let desc: String = c
        .query_row("SELECT description FROM transactions WHERE type=1", [], |r| r.get(0))
        .unwrap();
    assert!(desc.contains("(entrada)"));

    // mês 2: só parcela, sem duplicar a entrada
    domain::generate_loan_installments(&c, chrono::NaiveDate::from_ymd_opt(2026, 2, 1).unwrap()).unwrap();
    let total: i64 = c
        .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
        .unwrap();
    assert_eq!(total, 3);
}

#[test]
fn sync_generated_cobre_meses_com_movimento() {
    let c = conn();
    c.execute(
        "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
         VALUES ('Conta', 5000, 10, 1, '2025-01', NULL, NULL)",
        [],
    )
    .unwrap();
    // transação manual em 2026-01 (sem conta gerada ainda)
    c.execute(
        "INSERT INTO transactions (description, amount, type, date) VALUES ('Manual', 100, 1, '2026-01-05')",
        [],
    )
    .unwrap();
    report::sync_generated(&c, chrono::NaiveDate::from_ymd_opt(2026, 2, 1).unwrap()).unwrap();
    let n: i64 = c
        .query_row("SELECT COUNT(*) FROM transactions WHERE fixed_bill_id IS NOT NULL", [], |r| r.get(0))
        .unwrap();
    assert_eq!(n, 1, "conta fixa gerada para 2026-01 (mês com movimento)");
}

use ajudafinancas_lib::organizacao_financeira::models::LoanInput;

#[test]
fn taxa_mensal_bissecao_reconstroi_fluxo() {
    let l = LoanInput {
        type_: 1,
        description: "x".into(),
        principal: 100_000,
        installment: 35_000,
        total_installments: 3,
        day: 10,
        start_month: "2026-01".into(),
        payment_method_id: 1,
        monthly_rate: 0.0,
    };
    let rate = domain::loan_monthly_rate(l.principal, l.installment, l.total_installments);
    assert!(rate > 0.0 && rate < 0.5, "taxa = {rate}");
    // PV = PMT * (1-(1+i)^-n)/i deve aproximar o principal
    let pv = (l.installment as f64) * (1.0 - (1.0 + rate).powf(-(l.total_installments as f64))) / rate;
    assert!((pv - l.principal as f64).abs() < 1.0, "pv={pv}");

    let zero = domain::loan_monthly_rate(100, 10, 5);
    assert_eq!(zero, 0.0, "total <= principal => taxa 0");
}

#[test]
fn schedule_amortiza_ate_zero() {
    let l = LoanInput {
        type_: 1,
        description: "x".into(),
        principal: 300_000,
        installment: 110_000,
        total_installments: 3,
        day: 15,
        start_month: "2026-01".into(),
        payment_method_id: 1,
        monthly_rate: 0.0,
    };
    let rows = domain::loan_schedule(l.principal, l.installment, l.total_installments, &l.start_month, l.monthly_rate, "2026-03");
    assert_eq!(rows.len() as i64, l.total_installments);
    let sum_principal: i64 = rows.iter().map(|r| r.principal).sum();
    assert_eq!(sum_principal, l.principal, "soma das amortizações = principal");
    assert_eq!(rows.last().unwrap().balance, 0, "saldo final zero");
    assert_eq!(rows[0].month, "2026-01");
    assert_eq!(rows[2].month, "2026-03");
}

#[test]
fn liquidacao_antecipada_desconta_na_taxa_contratada() {
    // Caso real: 48.900 em 60x de 1.382,16. Taxa contratada ≈ 1,6457% a.m.
    // (implicada pelo valor do banco de 591,48 p/ a parcela 60 em 2026-08).
    let rate = 0.016457;
    let rows = domain::loan_schedule(4_890_000, 138_216, 60, "2026-01", rate, "2026-08");
    assert!(
        (591_46..=591_50).contains(&rows[59].settlement),
        "liquidação da parcela 60 hoje = {}",
        rows[59].settlement
    );
    assert_eq!(rows[0].settlement, 0, "parcela vencida não tem liquidação antecipada");
    // Taxa informada rege a tabela: juros da 1ª parcela = saldo × taxa.
    let expected_interest = (4_890_000.0 * rate).round() as i64;
    assert_eq!(rows[0].interest, expected_interest);
}
