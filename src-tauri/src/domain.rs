use chrono::NaiveDate;
use rusqlite::Connection;

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
