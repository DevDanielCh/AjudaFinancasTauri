use crate::db::{with_db, AppState};
use crate::domain;
use crate::organizacao_financeira::models::{PaymentMethod, PaymentMethodInput};
use crate::shared::card_bills;
use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

#[tauri::command]
pub async fn list_payment_methods(
    state: State<'_, AppState>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<PaymentMethod>, String> {
    with_db(&state, |c| list(c, sort_by.as_deref(), sort_dir.as_deref()))
}

fn list(
    conn: &Connection,
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<Vec<PaymentMethod>, String> {
    let order = domain::order_clause(
        sort_by,
        sort_dir,
        &[("name", "name"), ("type", "type")],
        "ORDER BY name",
        "id DESC",
    );
    let mut stmt = conn
        .prepare(&format!("SELECT id, name, type, metadata FROM payment_methods {order}"))
        .map_err(domain::db_err)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(PaymentMethod {
                id: r.get(0)?,
                name: r.get(1)?,
                type_: r.get(2)?,
                metadata: r.get(3)?,
            })
        })
        .map_err(domain::db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(domain::db_err)?;
    Ok(rows)
}

fn metadata_for(input: &PaymentMethodInput) -> Option<String> {
    if input.type_ != 2 {
        return None;
    }
    let close = input.close_day.unwrap_or(0);
    let validity = input.validity_day.unwrap_or(0);
    Some(
        serde_json::json!({ "close_day": close, "validity_day": validity }).to_string(),
    )
}

fn validate(input: &PaymentMethodInput) -> Result<(), String> {
    if input.name.trim().is_empty() {
        return Err("nome é obrigatório".into());
    }
    if input.type_ != 1 && input.type_ != 2 {
        return Err("tipo inválido".into());
    }
    if let Some(d) = input.close_day {
        if !(1..=31).contains(&d) {
            return Err("dia de fechamento deve estar entre 1 e 31".into());
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn create_payment_method(
    state: State<'_, AppState>,
    input: PaymentMethodInput,
) -> Result<(), String> {
    validate(&input)?;
    with_db(&state, |c| create(c, &input))
}

pub fn create(conn: &Connection, input: &PaymentMethodInput) -> Result<(), String> {
    let name = input.name.trim();
    let dup = conn
        .query_row(
            "SELECT 1 FROM payment_methods WHERE name = ?1 LIMIT 1",
            params![name],
            |_| Ok(()),
        )
        .optional()
        .map_err(domain::db_err)?;
    if dup.is_some() {
        return Err("já existe forma de pagamento com esse nome".into());
    }
    conn.execute(
        "INSERT INTO payment_methods (name, type, metadata) VALUES (?1, ?2, ?3)",
        params![name, input.type_, metadata_for(input)],
    )
    .map_err(domain::db_err)?;
    Ok(())
}

#[tauri::command]
pub async fn update_payment_method(
    state: State<'_, AppState>,
    id: i64,
    input: PaymentMethodInput,
) -> Result<(), String> {
    validate(&input)?;
    with_db(&state, |c| {
        let affected = c
            .execute(
                "UPDATE payment_methods SET name = ?1, type = ?2, metadata = ?3 WHERE id = ?4",
                params![input.name.trim(), input.type_, metadata_for(&input), id],
            )
            .map_err(domain::db_err)?;
        if affected == 0 {
            return Err("forma de pagamento não encontrada".into());
        }
        card_bills::refresh_card_bills(c)?;
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_payment_methods(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| {
        let placeholders = vec!["?"; ids.len()].join(",");
        c.execute(
            &format!("DELETE FROM payment_methods WHERE id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(domain::db_err)?;
        Ok(())
    })
}
