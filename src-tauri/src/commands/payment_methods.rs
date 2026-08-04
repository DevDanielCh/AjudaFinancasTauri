use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::{PaymentMethod, PaymentMethodInput};
use rusqlite::{params, Connection};
use tauri::State;

#[tauri::command]
pub async fn list_payment_methods(state: State<'_, AppState>) -> Result<Vec<PaymentMethod>, String> {
    with_db(&state, list)
}

fn list(conn: &Connection) -> Result<Vec<PaymentMethod>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, type, metadata FROM payment_methods ORDER BY name")
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
    with_db(&state, |c| {
        c.execute(
            "INSERT INTO payment_methods (name, type, metadata) VALUES (?1, ?2, ?3)",
            params![input.name.trim(), input.type_, metadata_for(&input)],
        )
        .map_err(domain::db_err)?;
        Ok(())
    })
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
