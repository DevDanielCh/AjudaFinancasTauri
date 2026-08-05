use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::{CardBillDetail, TransactionInput, TransactionRow};
use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

#[tauri::command]
pub async fn list_transactions(
    state: State<'_, AppState>,
    month: Option<String>,
) -> Result<Vec<TransactionRow>, String> {
    with_db(&state, |c| list(c, month.as_deref()))
}

fn list(conn: &Connection, month: Option<&str>) -> Result<Vec<TransactionRow>, String> {
    let (start, end, ref_month) = match month {
        Some(m) if !m.is_empty() => {
            let (s, e) = domain::month_range(m)?;
            (Some(s), Some(e), Some(domain::parse_month(m)?))
        }
        _ => (None, None, None),
    };
    if let Some(m) = ref_month {
        domain::ensure_card_bills(conn, m)?;
    }
    let mut sql = String::from(
        "SELECT t.id, t.description, t.amount, t.type, t.date,
                t.category_id, c.name, t.payment_method_id, pm.name,
                t.fixed_bill_id, t.loan_id, (t.bill_start IS NOT NULL)
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
                    is_card_bill: r.get(11)?,
                    installment: None,
                })
            },
        )
        .map_err(domain::db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(domain::db_err)?;
    let card_ids = domain::fatura_capable_card_ids(conn)?;
    Ok(rows
        .into_iter()
        .filter(|r| {
            r.is_card_bill
                || r.payment_method_id.is_none_or(|id| !card_ids.contains(&id))
        })
        .collect())
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
        domain::refresh_card_bills(c)?;
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
        domain::refresh_card_bills(c)?;
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_transactions(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| {
        delete_ids(c, &ids)?;
        domain::refresh_card_bills(c)
    })
}

pub fn delete_ids(conn: &Connection, ids: &[i64]) -> Result<(), String> {
    let placeholders = vec!["?"; ids.len()].join(",");
    let sql = format!("DELETE FROM transactions WHERE id IN ({placeholders})");
    conn.execute(&sql, rusqlite::params_from_iter(ids.iter()))
        .map_err(domain::db_err)?;
    Ok(())
}

#[tauri::command]
pub async fn get_card_bill(state: State<'_, AppState>, id: i64) -> Result<CardBillDetail, String> {
    with_db(&state, |c| {
        let row: Option<(i64, String, Option<String>, Option<String>, String, String)> = c
            .query_row(
                "SELECT t.payment_method_id, pm.name, t.bill_start, t.bill_end, t.date, t.description
                 FROM transactions t
                 LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
                 WHERE t.id = ?1",
                params![id],
                |r| {
                    Ok((
                        r.get(0)?,
                        r.get(1)?,
                        r.get(2)?,
                        r.get(3)?,
                        r.get(4)?,
                        r.get(5)?,
                    ))
                },
            )
            .optional()
            .map_err(domain::db_err)?;
        let Some((pm_id, pm_name, bill_start, bill_end, due, description)) = row else {
            return Err("fatura não encontrada".into());
        };
        let (Some(bs), Some(be)) = (bill_start, bill_end) else {
            return Err("transação não é uma fatura".into());
        };
        let mut stmt = c
            .prepare(
                "SELECT t.id, t.description, t.amount, t.type, t.date,
                        t.category_id, cat.name, t.payment_method_id, pm.name,
                        t.fixed_bill_id, t.loan_id, 0,
                        fb.installments, fb.start_month
                 FROM transactions t
                 LEFT JOIN categories cat ON cat.id = t.category_id
                 LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
                 LEFT JOIN fixed_bills fb ON fb.id = t.fixed_bill_id
                 WHERE t.payment_method_id = ?1 AND t.bill_start IS NULL
                   AND t.date >= ?2 AND t.date < ?3
                 ORDER BY t.date ASC, t.id ASC",
            )
            .map_err(domain::db_err)?;
        let txs = stmt
            .query_map(params![pm_id, bs, be], |r| {
                let date: String = r.get(4)?;
                let installments: Option<i64> = r.get(12)?;
                let start_month: Option<String> = r.get(13)?;
                let installment = match (installments, start_month) {
                    (Some(total), Some(sm)) if total >= 1 => {
                        Some(format!("{}/{}", domain::installment_index(&sm, &date[..7]), total))
                    }
                    _ => None,
                };
                Ok(TransactionRow {
                    id: r.get(0)?,
                    description: r.get(1)?,
                    amount: r.get(2)?,
                    type_: r.get(3)?,
                    date,
                    category_id: r.get(5)?,
                    category_name: r.get(6)?,
                    payment_method_id: r.get(7)?,
                    payment_method_name: r.get(8)?,
                    fixed_bill_id: r.get(9)?,
                    loan_id: r.get(10)?,
                    is_card_bill: false,
                    installment,
                })
            })
            .map_err(domain::db_err)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(domain::db_err)?;
        let total: i64 = txs.iter().map(|t| t.amount).sum();
        Ok(CardBillDetail {
            id,
            description,
            payment_method_name: pm_name,
            period_start: bs,
            period_end: be,
            due_date: due,
            total,
            transactions: txs,
        })
    })
}
