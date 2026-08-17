use chrono::NaiveDate;
use rusqlite::Connection;

use crate::shared::util::db_err;

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
}
