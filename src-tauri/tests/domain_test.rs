use ajudafinancas_lib::domain::{billing_period, month_range};
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
