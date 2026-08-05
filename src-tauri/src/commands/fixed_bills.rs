use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::{FixedBill, FixedBillInput};
use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

#[tauri::command]
pub async fn list_fixed_bills(
    state: State<'_, AppState>,
    only_installments: bool,
) -> Result<Vec<FixedBill>, String> {
    with_db(&state, |c| list(c, only_installments))
}

fn list(conn: &Connection, only_installments: bool) -> Result<Vec<FixedBill>, String> {
    let (cond, order) = if only_installments {
        ("b.installments IS NOT NULL", "b.start_month DESC, b.id DESC")
    } else {
        ("b.installments IS NULL", "b.start_month ASC, b.id ASC")
    };
    let sql = format!(
        "SELECT b.id, b.description, b.amount, b.day, b.category_id, c.name,
                b.payment_method_id, pm.name, b.start_month, b.end_month, b.installments, b.purchase_date
         FROM fixed_bills b
         LEFT JOIN categories c ON c.id = b.category_id
         JOIN payment_methods pm ON pm.id = b.payment_method_id
         WHERE {cond}
         ORDER BY {order}"
    );
    let mut stmt = conn.prepare(&sql).map_err(domain::db_err)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(FixedBill {
                id: r.get(0)?,
                description: r.get(1)?,
                amount: r.get(2)?,
                day: r.get(3)?,
                category_id: r.get(4)?,
                category_name: r.get(5)?,
                payment_method_id: r.get(6)?,
                payment_method_name: r.get(7)?,
                start_month: r.get(8)?,
                end_month: r.get(9)?,
                installments: r.get(10)?,
                purchase_date: r.get(11)?,
            })
        })
        .map_err(domain::db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(domain::db_err)?;
    Ok(rows)
}

/// Se a forma de pagamento é cartão com dia de fechamento, o dia da conta vira o de fechamento.
fn apply_card_day(conn: &Connection, input: &mut FixedBillInput) -> Result<(), String> {
    let pm: Option<(i64, Option<String>)> = conn
        .query_row(
            "SELECT type, metadata FROM payment_methods WHERE id = ?1",
            params![input.payment_method_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(domain::db_err)?;
    if let Some((ty, meta)) = pm {
        if ty == 2 {
            let cd: Option<i64> = meta
                .as_deref()
                .and_then(|m| serde_json::from_str::<serde_json::Value>(m).ok())
                .and_then(|v| v.get("close_day")?.as_i64());
            if let Some(cd) = cd {
                if cd > 0 {
                    input.day = cd;
                }
            }
        }
    }
    Ok(())
}

/// Deriva mês/dia do parcelamento a partir da data da compra.
fn apply_purchase_date(input: &mut FixedBillInput) -> Result<(), String> {
    if let Some(pd) = input.purchase_date.clone() {
        let (start_month, day) = domain::purchase_installment(&pd)?;
        input.start_month = start_month;
        input.day = day;
    }
    Ok(())
}

#[tauri::command]
pub async fn create_fixed_bill(
    state: State<'_, AppState>,
    mut input: FixedBillInput,
) -> Result<(), String> {
    if input.installments.is_some() {
        input = input.normalized()?;
    }
    input.validate()?;
    with_db(&state, |c| {
        if input.purchase_date.is_some() {
            apply_purchase_date(&mut input)?;
        } else {
            apply_card_day(c, &mut input)?;
        }
        let end_month = input.end_month.clone();
        c.execute(
            "INSERT INTO fixed_bills (description, amount, day, category_id, payment_method_id, start_month, end_month, installments, purchase_date)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                input.description.trim(),
                input.amount,
                input.day,
                input.category_id,
                input.payment_method_id,
                input.start_month,
                end_month,
                input.installments,
                input.purchase_date
            ],
        )
        .map_err(domain::db_err)?;
        Ok(())
    })
}

#[tauri::command]
pub async fn update_fixed_bill(
    state: State<'_, AppState>,
    id: i64,
    mut input: FixedBillInput,
) -> Result<(), String> {
    if input.installments.is_some() {
        input = input.normalized()?;
    }
    input.validate()?;
    with_db(&state, |c| {
        if input.purchase_date.is_some() {
            apply_purchase_date(&mut input)?;
        } else {
            apply_card_day(c, &mut input)?;
        }
        let affected = c
            .execute(
                "UPDATE fixed_bills SET description = ?1, amount = ?2, day = ?3, category_id = ?4,
                        payment_method_id = ?5, start_month = ?6, end_month = ?7, installments = ?8, purchase_date = ?9
                 WHERE id = ?10",
                params![
                    input.description.trim(),
                    input.amount,
                    input.day,
                    input.category_id,
                    input.payment_method_id,
                    input.start_month,
                    input.end_month,
                    input.installments,
                    input.purchase_date,
                    id
                ],
            )
            .map_err(domain::db_err)?;
        if affected == 0 {
            return Err("conta fixa não encontrada".into());
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_fixed_bills(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| {
        let placeholders = vec!["?"; ids.len()].join(",");
        c.execute(
            &format!("DELETE FROM transactions WHERE fixed_bill_id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(domain::db_err)?;
        c.execute(
            &format!("DELETE FROM fixed_bills WHERE id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(domain::db_err)?;
        domain::refresh_card_bills(c)
    })
}
