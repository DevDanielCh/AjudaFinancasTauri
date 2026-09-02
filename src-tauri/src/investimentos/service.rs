use chrono::NaiveDate;
use rusqlite::Connection;

use crate::shared::util::db_err;

/// Soma dos aportes à reserva (type = 4) no período que movimentam a conta
/// principal (in_principal = 1). Rendimentos diretos na reserva não contam.
pub fn month_investments(conn: &Connection, account_id: i64, start: NaiveDate, end: NaiveDate) -> Result<i64, String> {
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE type = 4 AND in_principal = 1 AND date >= ?1 AND date < ?2 AND account_id = ?3",
            rusqlite::params![start.format("%Y-%m-%d").to_string(), end.format("%Y-%m-%d").to_string(), account_id],
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
        assert_eq!(month_investments(&conn, 1, jun, jul).unwrap(), 1000, "só type 4 do mês");
    }

    #[test]
    fn rendimento_nao_conta_como_aporte_da_meta() {
        let conn = test_db();
        conn.execute_batch(
            "INSERT INTO transactions (description, amount, type, date, in_principal) VALUES
             ('rendimento', 5000, 4, '2026-06-10', 0),
             ('aporte', 2000, 4, '2026-06-20', 1)",
        )
        .unwrap();
        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        let jul = NaiveDate::from_ymd_opt(2026, 7, 1).unwrap();
        assert_eq!(
            month_investments(&conn, 1, jun, jul).unwrap(),
            2000,
            "in_principal = 0 não conta como aporte"
        );
    }
}
