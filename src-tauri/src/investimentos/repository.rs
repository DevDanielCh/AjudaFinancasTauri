use chrono::NaiveDate;
use rusqlite::Connection;

use crate::organizacao_financeira::models::TransactionRow;
use crate::shared::settings;
use crate::shared::util::{db_err, parse_month};

pub fn list_reserva_movements_impl(conn: &Connection, account_id: i64) -> Result<Vec<TransactionRow>, String> {
    let s = settings::get_settings_impl(conn, account_id)?;
    let piso = match &s.primeiro_mes {
        Some(m) => parse_month(m)?.format("%Y-%m-%d").to_string(),
        None => "0000-01-01".to_string(),
    };
    let mut stmt = conn
        .prepare(
             "SELECT t.id, t.description, t.amount, t.type, t.date,
                    t.category_id, c.name, t.payment_method_id, pm.name,
                    t.fixed_bill_id, t.loan_id, (t.bill_start IS NOT NULL), t.card_mode
             FROM transactions t
             LEFT JOIN categories c ON c.id = t.category_id AND c.deleted_at IS NULL
             LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id AND pm.deleted_at IS NULL
             WHERE t.type IN (4, 5) AND t.date >= ?1 AND t.deleted_at IS NULL AND t.account_id = ?2
             ORDER BY t.date DESC, t.id DESC",
        )
        .map_err(db_err)?;
    let rows = stmt
        .query_map(rusqlite::params![piso, account_id], |r| {
            Ok(TransactionRow {
                id: r.get(0)?,
                description: r.get(1)?,
                amount: r.get(2)?,
                type_: r.get(3)?,
                date: r.get(4)?,
                category_id: r.get(5)?,
                category_name: r.get(6)?,
                payment_method_id: r.get(7)?,
                payment_method_name: r.get(8)?,
                fixed_bill_id: r.get(9)?,
                loan_id: r.get(10)?,
                is_card_bill: r.get(11)?,
                card_mode: r.get(12)?,
                installment: None,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(rows)
}

/// Saldo da reserva/investimentos acumulado até `before` (data exclusiva).
pub fn reserva_balance_at(conn: &Connection, account_id: i64, before: NaiveDate) -> Result<i64, String> {
    let s = settings::get_settings_impl(conn, account_id)?;
    let piso = match &s.primeiro_mes {
        Some(m) => parse_month(m)?.format("%Y-%m-%d").to_string(),
        None => "0000-01-01".to_string(),
    };
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(CASE WHEN type = 4 THEN amount WHEN type = 5 THEN -amount ELSE 0 END), 0)
             FROM transactions WHERE date >= ?1 AND date < ?2 AND deleted_at IS NULL AND account_id = ?3",
            rusqlite::params![piso, before.format("%Y-%m-%d").to_string(), account_id],
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
        assert_eq!(reserva_balance_at(&conn, 1, jun).unwrap(), 100000, "antes do resgate");
        let jul = NaiveDate::from_ymd_opt(2026, 7, 1).unwrap();
        assert_eq!(reserva_balance_at(&conn, 1, jul).unwrap(), 70000, "após resgate e sem o 2º aporte");
        let set = NaiveDate::from_ymd_opt(2026, 9, 1).unwrap();
        assert_eq!(reserva_balance_at(&conn, 1, set).unwrap(), 90000, "transação normal ignorada");
    }
}
