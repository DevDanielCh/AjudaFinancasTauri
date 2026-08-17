use chrono::{Datelike, Months, NaiveDate};
use rusqlite::Connection;

use crate::organizacao_financeira::models::AmortizationRow;
use crate::shared::settings;

pub use crate::shared::util::{current_month, db_err, month_diff, month_range, order_clause, parse_month};

pub const FINISHED_GUARD_SQL: &str = "fb.installments IS NULL OR \
((CAST(strftime('%Y', t.date) AS INTEGER) * 12 + CAST(strftime('%m', t.date) AS INTEGER)) \
- (CAST(substr(fb.start_month, 1, 4) AS INTEGER) * 12 + CAST(substr(fb.start_month, 6, 2) AS INTEGER))) \
< fb.installments";

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
            let due_day = day.min(crate::shared::card_bills::last_day_of(month) as i64) as u32;
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
    use crate::shared::test_db;

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
