use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::{TransactionInput, TransactionRow};
use rusqlite::{params, Connection};
use tauri::State;

#[tauri::command]
pub async fn list_transactions(
    state: State<'_, AppState>,
    month: Option<String>,
) -> Result<Vec<TransactionRow>, String> {
    with_db(&state, |c| list(c, month.as_deref()))
}

fn list(conn: &Connection, month: Option<&str>) -> Result<Vec<TransactionRow>, String> {
    let (start, end) = match month {
        Some(m) if !m.is_empty() => {
            let (s, e) = domain::month_range(m)?;
            (Some(s), Some(e))
        }
        _ => (None, None),
    };
    let mut sql = String::from(
        "SELECT t.id, t.description, t.amount, t.type, t.date,
                t.category_id, c.name, t.payment_method_id, pm.name,
                t.fixed_bill_id, t.loan_id
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id",
    );
    if start.is_some() {
        sql.push_str(" WHERE t.date >= ?1 AND t.date < ?2");
    }
    sql.push_str(" ORDER BY t.date DESC, t.id DESC");
    let mut stmt = conn.prepare(&sql).map_err(domain::db_err)?;
    let rows = stmt
        .query_map(
            params![
                start.map(|d| d.format("%Y-%m-%d").to_string()),
                end.map(|d| d.format("%Y-%m-%d").to_string())
            ],
            |r| {
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
                })
            },
        )
        .map_err(domain::db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(domain::db_err)?;
    Ok(rows)
}

#[tauri::command]
pub async fn create_transaction(
    state: State<'_, AppState>,
    input: TransactionInput,
) -> Result<(), String> {
    input.validate()?;
    with_db(&state, |c| {
        c.execute(
            "INSERT INTO transactions (description, amount, type, date, category_id, payment_method_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                input.description.trim(),
                input.amount,
                input.type_,
                input.date,
                input.category_id,
                input.payment_method_id
            ],
        )
        .map_err(domain::db_err)?;
        Ok(())
    })
}

#[tauri::command]
pub async fn update_transaction(
    state: State<'_, AppState>,
    id: i64,
    input: TransactionInput,
) -> Result<(), String> {
    input.validate()?;
    with_db(&state, |c| {
        let affected = c
            .execute(
                "UPDATE transactions SET description = ?1, amount = ?2, type = ?3, date = ?4,
                        category_id = ?5, payment_method_id = ?6
                 WHERE id = ?7",
                params![
                    input.description.trim(),
                    input.amount,
                    input.type_,
                    input.date,
                    input.category_id,
                    input.payment_method_id,
                    id
                ],
            )
            .map_err(domain::db_err)?;
        if affected == 0 {
            return Err("transação não encontrada".into());
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_transactions(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| delete_ids(c, &ids))
}

pub fn delete_ids(conn: &Connection, ids: &[i64]) -> Result<(), String> {
    let placeholders = vec!["?"; ids.len()].join(",");
    let sql = format!("DELETE FROM transactions WHERE id IN ({placeholders})");
    conn.execute(&sql, rusqlite::params_from_iter(ids.iter()))
        .map_err(domain::db_err)?;
    Ok(())
}
