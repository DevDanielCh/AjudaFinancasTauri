use chrono::{Datelike, Months, NaiveDate};
use rusqlite::Connection;

use crate::shared::card_bills::{last_day_of, refresh_card_bills};
use crate::shared::settings;

pub use crate::shared::util::{current_month, db_err, month_diff, month_range, order_clause, parse_month};

/// Número da parcela (1-based) dado o mês inicial e o mês da parcela.
pub fn installment_index(start_month: &str, parcel_month: &str) -> i64 {
    month_diff(start_month, parcel_month).max(0) + 1
}

/// Verdadeiro quando a parcela de `row_month` ultrapassa o total (parcelamento encerrado).
pub fn installment_finished(start_month: &str, installments: i64, row_month: &str) -> bool {
    installments >= 1 && installment_index(start_month, row_month) > installments
}

/// Fragmento SQL que exclui parcelas além do total em consultas de fatura.
/// Espera aliases `t` (transactions) e `fb` (fixed_bills LEFT JOIN).
pub const FINISHED_GUARD_SQL: &str = "fb.installments IS NULL OR \
((CAST(strftime('%Y', t.date) AS INTEGER) * 12 + CAST(strftime('%m', t.date) AS INTEGER)) \
- (CAST(substr(fb.start_month, 1, 4) AS INTEGER) * 12 + CAST(substr(fb.start_month, 6, 2) AS INTEGER))) \
< fb.installments";

/// (mês YYYY-MM, dia) do parcelamento a partir da data da compra.
pub fn purchase_installment(purchase: &str) -> Result<(String, i64), String> {
    let d = NaiveDate::parse_from_str(purchase, "%Y-%m-%d")
        .map_err(|_| "data da compra inválida".to_string())?;
    Ok((d.format("%Y-%m").to_string(), d.day() as i64))
}

/// Soma dos aportes à reserva (type = 4) no período.
pub fn month_investments(conn: &Connection, start: NaiveDate, end: NaiveDate) -> Result<i64, String> {
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE type = 4 AND date >= ?1 AND date < ?2",
            rusqlite::params![start.format("%Y-%m-%d").to_string(), end.format("%Y-%m-%d").to_string()],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(v)
}

/// Saldo da reserva/investimentos acumulado até `before` (data exclusiva).
/// Adição (type=4) soma; remoção (type=5) subtrai. Com saldo inicial
/// configurado, soma-se a ele; com `primeiro_mes`, ignora-se antes do piso.
pub fn reserva_balance_at(conn: &Connection, before: NaiveDate) -> Result<i64, String> {
    let s = settings::get_settings_impl(conn)?;
    let piso = match &s.primeiro_mes {
        Some(m) => parse_month(m)?.format("%Y-%m-%d").to_string(),
        None => "0000-01-01".to_string(),
    };
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(CASE WHEN type = 4 THEN amount WHEN type = 5 THEN -amount ELSE 0 END), 0)
             FROM transactions WHERE date >= ?1 AND date < ?2",
            rusqlite::params![piso, before.format("%Y-%m-%d").to_string()],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(s.saldo_inicial_reserva + v)
}

/// Gera transações das contas fixas ativas no mês. Dia clampado ao último dia.
pub fn generate_fixed_bills(conn: &Connection, month: NaiveDate) -> Result<(), String> {
    let month_key = month.format("%Y-%m").to_string();
    let mut stmt = conn
        .prepare(
            "SELECT id, description, amount, day, category_id, payment_method_id, installments, start_month
             FROM fixed_bills
             WHERE start_month <= ?1 AND (end_month IS NULL OR end_month >= ?1)",
        )
        .map_err(db_err)?;
    let bills = stmt
        .query_map(rusqlite::params![month_key], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, Option<i64>>(4)?,
                r.get::<_, i64>(5)?,
                r.get::<_, Option<i64>>(6)?,
                r.get::<_, String>(7)?,
            ))
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;

    let start = month.with_day(1).unwrap().format("%Y-%m-%d").to_string();
    let end = month
        .checked_add_months(Months::new(1))
        .unwrap()
        .format("%Y-%m-%d")
        .to_string();
    let last = last_day_of(month) as i64;

    for (
        id,
        description,
        amount,
        day,
        category_id,
        payment_method_id,
        installments,
        start_month,
    ) in bills
    {
        if let Some(n) = installments {
            if month_diff(&start_month, &month_key) >= n {
                continue; // parcela além do total: plano encerrado
            }
        }
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE fixed_bill_id = ?1 AND date >= ?2 AND date < ?3",
                rusqlite::params![id, start, end],
                |r| r.get(0),
            )
            .map_err(db_err)?;
        if exists > 0 {
            continue;
        }
        let due = month
            .with_day(day.min(last) as u32)
            .unwrap()
            .format("%Y-%m-%d")
            .to_string();
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, category_id, payment_method_id, fixed_bill_id, loan_id)
             VALUES (?1, ?2, 2, ?3, ?4, ?5, ?6, NULL)",
            rusqlite::params![description, amount, due, category_id, payment_method_id, id],
        )
        .map_err(db_err)?;
    }
    Ok(())
}

/// Gera entrada (empréstimos) e parcelas mensais dos empréstimos ativos no mês.
pub fn generate_loan_installments(conn: &Connection, month: NaiveDate) -> Result<(), String> {
    let month_key = month.format("%Y-%m").to_string();
    let start = month.with_day(1).unwrap().format("%Y-%m-%d").to_string();
    let end = month
        .checked_add_months(Months::new(1))
        .unwrap()
        .format("%Y-%m-%d")
        .to_string();

    let mut stmt = conn
        .prepare(
            "SELECT id, type, description, principal, installment, total_installments, day, payment_method_id, start_month
             FROM loans",
        )
        .map_err(db_err)?;
    let loans = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, i64>(5)?,
                r.get::<_, i64>(6)?,
                r.get::<_, i64>(7)?,
                r.get::<_, String>(8)?,
            ))
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;

    for (id, ty, description, principal, installment, total_n, day, pm_id, start_month) in loans {
        if start_month > month_key {
            continue;
        }
        let loan_start = parse_month(&start_month).map_err(db_err)?;
        let loan_end = loan_start
            .checked_add_months(Months::new(total_n as u32 - 1))
            .unwrap();
        if loan_end < month {
            continue;
        }

        if ty == 1 {
            let exists: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM transactions WHERE loan_id = ?1 AND type = 1",
                    rusqlite::params![id],
                    |r| r.get(0),
                )
                .map_err(db_err)?;
            if exists == 0 {
                conn.execute(
                    "INSERT INTO transactions (description, amount, type, date, payment_method_id, loan_id)
                     VALUES (?1, ?2, 1, ?3, ?4, ?5)",
                    rusqlite::params![
                        format!("{description} (entrada)"),
                        principal,
                        loan_start.format("%Y-%m-%d").to_string(),
                        pm_id,
                        id
                    ],
                )
                .map_err(db_err)?;
            }
        }

        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE loan_id = ?1 AND type = 2 AND date >= ?2 AND date < ?3",
                rusqlite::params![id, start, end],
                |r| r.get(0),
            )
            .map_err(db_err)?;
        if exists == 0 {
            let due_day = day.min(last_day_of(month) as i64) as u32;
            let due = month.with_day(due_day).unwrap().format("%Y-%m-%d").to_string();
            conn.execute(
                "INSERT INTO transactions (description, amount, type, date, payment_method_id, loan_id)
                 VALUES (?1, ?2, 2, ?3, ?4, ?5)",
                rusqlite::params![description, installment, due, pm_id, id],
            )
            .map_err(db_err)?;
        }
    }
    Ok(())
}

use crate::organizacao_financeira::models::AmortizationRow;

/// Regera contas fixas dos meses de `início` até `now` (inclui meses vazios) e
/// recalcula as faturas. Chamado ao criar/editar conta fixa para o app refletir
/// as transações imediatamente.
pub fn reconcile_fixed_bills(conn: &Connection, start_month: &str, now: NaiveDate) -> Result<(), String> {
    let min = settings::earliest_month(conn)?.min(start_month.to_string());
    let mut m = parse_month(&min)?;
    while m <= now {
        generate_fixed_bills(conn, m)?;
        m = m.checked_add_months(Months::new(1)).unwrap();
    }
    refresh_card_bills(conn)
}

/// Taxa mensal i que resolve PV = PMT * (1-(1+i)^-n)/i por bisseção.
pub fn loan_monthly_rate(principal: i64, installment: i64, n: i64) -> f64 {
    if principal <= 0 || installment <= 0 || n < 1 {
        return 0.0;
    }
    let pv = principal as f64;
    let pmt = installment as f64;
    let n = n as f64;
    if pmt * n <= pv {
        return 0.0;
    }
    let g = |i: f64| pmt * (1.0 - (1.0 + i).powf(-n)) / i - pv;
    let mut lo = 0.0;
    let mut hi = 0.0001;
    while g(hi) > 0.0 && hi < 100.0 {
        hi *= 2.0;
    }
    for _ in 0..200 {
        let mid = (lo + hi) / 2.0;
        if g(mid) > 0.0 {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    (lo + hi) / 2.0
}

/// Tabela de amortização (parcelas iguais, juros sobre saldo devedor).
/// `rate`: taxa mensal contratada (fração); 0 ou negativo deriva da parcela.
/// `as_of_month`: mês de referência para o valor de liquidação antecipada (hoje).
pub fn loan_schedule(
    principal: i64,
    installment: i64,
    n: i64,
    start_month: &str,
    rate: f64,
    as_of_month: &str,
) -> Vec<AmortizationRow> {
    let rate = if rate > 0.0 {
        rate
    } else {
        loan_monthly_rate(principal, installment, n)
    };
    let mut balance = principal;
    let mut rows = Vec::with_capacity(n as usize);
    for k in 1..=n {
        let interest = (balance as f64 * rate).round() as i64;
        let mut p = installment - interest;
        let mut paid = installment;
        if k == n {
            p = balance;
            paid = interest + p;
        }
        balance -= p;
        let month = parse_month(start_month)
            .unwrap()
            .checked_add_months(Months::new(k as u32 - 1))
            .unwrap()
            .format("%Y-%m")
            .to_string();
        let t = month_diff(as_of_month, &month);
        let settlement = if t > 0 {
            (installment as f64 / (1.0 + rate).powf(t as f64)).round() as i64
        } else {
            0
        };
        rows.push(AmortizationRow {
            number: k,
            month,
            installment: paid,
            interest,
            principal: p,
            balance,
            settlement,
        });
    }
    rows
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::{add_pm, test_db};
    use rusqlite::params;

    #[test]
    fn month_investments_soma_aportes_do_mes() {
        let conn = test_db();
        conn.execute_batch(
            "INSERT INTO transactions (description, amount, type, date) VALUES
             ('aporte', 1000, 4, '2026-06-10'),
             ('resgate', 300, 5, '2026-06-15'),
             ('despesa', 500, 2, '2026-06-20'),
             ('aporte', 2000, 4, '2026-07-01')",
        )
        .unwrap();
        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        let jul = NaiveDate::from_ymd_opt(2026, 7, 1).unwrap();
        assert_eq!(month_investments(&conn, jun, jul).unwrap(), 1000, "só type 4 do mês");
    }

    #[test]
    fn purchase_installment_uses_purchase_month_and_day() {
        assert_eq!(
            purchase_installment("2025-11-20").unwrap(),
            ("2025-11".to_string(), 20)
        );
        assert_eq!(
            purchase_installment("2025-01-05").unwrap(),
            ("2025-01".to_string(), 5)
        );
    }

    #[test]
    fn installment_finished_edges() {
        assert!(!installment_finished("2026-01", 3, "2026-01")); // 1/3
        assert!(!installment_finished("2026-01", 3, "2026-03")); // 3/3, último
        assert!(installment_finished("2026-01", 3, "2026-04")); // 4/3, passou
        assert!(!installment_finished("2026-01", 3, "2025-12")); // antes do início → index 1
        assert!(!installment_finished("2026-01", 0, "2026-04")); // total inválido
    }

    #[test]
    fn purchase_installment_rejects_invalid_date() {
        assert!(purchase_installment("20/11/2025").is_err());
        assert!(purchase_installment("garbage").is_err());
    }

    #[test]
    fn generate_stops_at_installments_count() {
        let conn = test_db();
        let pm = add_pm(&conn, "PIX", 1, None);
        // plano com end_month largo (drift de dados antigo): start 2026-01, 3 parcelas, end 2026-06
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
             VALUES ('parcela', 1000, 10, ?1, '2026-01', '2026-06', 3)",
            params![pm],
        )
        .unwrap();

        generate_fixed_bills(&conn, NaiveDate::from_ymd_opt(2026, 3, 1).unwrap()).unwrap();
        generate_fixed_bills(&conn, NaiveDate::from_ymd_opt(2026, 4, 1).unwrap()).unwrap();

        let rows: i64 = conn
            .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
            .unwrap();
        assert_eq!(rows, 1, "março (3/3) gera; abril (4/3) para");
    }

    #[test]
    fn reconcile_generates_bills_in_empty_months() {
        let conn = test_db();
        let pix = add_pm(&conn, "PIX", 1, None);
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, category_id, payment_method_id, start_month, end_month, installments)
             VALUES ('Internet', 12000, 5, NULL, ?1, '2026-05', NULL, NULL)",
            params![pix],
        )
        .unwrap();
        let bill_id = conn.last_insert_rowid();

        reconcile_fixed_bills(&conn, "2026-05", NaiveDate::from_ymd_opt(2026, 7, 1).unwrap()).unwrap();

        let dates: Vec<String> = {
            let mut stmt = conn
                .prepare("SELECT date FROM transactions WHERE fixed_bill_id = ?1 ORDER BY date")
                .unwrap();
            let rows = stmt
                .query_map(params![bill_id], |r| r.get(0))
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap();
            rows
        };
        assert_eq!(dates, vec!["2026-05-05", "2026-06-05", "2026-07-05"]);
    }

    #[test]
    fn reconcile_starts_at_bill_month_when_no_transactions() {
        let conn = test_db();
        let pix = add_pm(&conn, "PIX", 1, None);
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, category_id, payment_method_id, start_month, end_month, installments)
             VALUES ('Aluguel', 80000, 10, NULL, ?1, '2026-06', NULL, NULL)",
            params![pix],
        )
        .unwrap();
        let bill_id = conn.last_insert_rowid();

        reconcile_fixed_bills(&conn, "2026-06", NaiveDate::from_ymd_opt(2026, 8, 1).unwrap()).unwrap();

        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE fixed_bill_id = ?1",
                params![bill_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 3);
    }

    #[test]
    fn installment_index_counts_from_start() {
        assert_eq!(installment_index("2026-05", "2026-05"), 1);
        assert_eq!(installment_index("2026-05", "2026-06"), 2);
        assert_eq!(installment_index("2026-05", "2026-07"), 3);
        assert_eq!(installment_index("2025-11", "2026-07"), 9);
        assert_eq!(installment_index("2026-07", "2026-05"), 1);
    }

    #[test]
    fn reserva_balance_acumula_por_tipo() {
        let conn = test_db();
        conn.execute_batch(
            "INSERT INTO transactions (description, amount, type, date) VALUES
             ('aporte', 100000, 4, '2026-05-10'),
             ('resgate', 30000, 5, '2026-06-15'),
             ('normal', 50000, 2, '2026-06-20'),
             ('aporte', 20000, 4, '2026-07-01')",
        )
        .unwrap();

        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        assert_eq!(reserva_balance_at(&conn, jun).unwrap(), 100000, "antes do resgate");
        let jul = NaiveDate::from_ymd_opt(2026, 7, 1).unwrap();
        assert_eq!(reserva_balance_at(&conn, jul).unwrap(), 70000, "após resgate e sem o 2º aporte");
        let set = NaiveDate::from_ymd_opt(2026, 9, 1).unwrap();
        assert_eq!(reserva_balance_at(&conn, set).unwrap(), 90000, "transação normal ignorada");
    }
}
