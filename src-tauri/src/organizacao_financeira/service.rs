use crate::organizacao_financeira::models::{CategoryInput, PaymentMethodInput};
use crate::shared::card_bills;
use crate::shared::util::db_err;
use rusqlite::{params, Connection, OptionalExtension};

pub fn create_category(conn: &Connection, input: &CategoryInput) -> Result<(), String> {
    let name = input.name.trim();
    let dup = conn
        .query_row(
            "SELECT 1 FROM categories WHERE name = ?1 LIMIT 1",
            params![name],
            |_| Ok(()),
        )
        .optional()
        .map_err(db_err)?;
    if dup.is_some() {
        return Err("já existe categoria com esse nome".into());
    }
    conn.execute(
        "INSERT INTO categories (name, type, color, icon) VALUES (?1, ?2, ?3, ?4)",
        params![name, input.type_, input.color, input.icon],
    )
    .map_err(db_err)?;
    Ok(())
}

pub(crate) fn validate_category(input: &CategoryInput) -> Result<(), String> {
    if input.name.trim().is_empty() {
        return Err("nome é obrigatório".into());
    }
    if input.type_ != 1 && input.type_ != 2 {
        return Err("tipo inválido".into());
    }
    Ok(())
}

pub(crate) fn update_category(conn: &Connection, id: i64, input: &CategoryInput) -> Result<(), String> {
    let affected = conn
        .execute(
            "UPDATE categories SET name = ?1, type = ?2, color = ?3, icon = ?4 WHERE id = ?5",
            params![input.name.trim(), input.type_, input.color, input.icon, id],
        )
        .map_err(db_err)?;
    if affected == 0 {
        return Err("categoria não encontrada".into());
    }
    Ok(())
}

pub(crate) fn delete_categories(conn: &Connection, ids: &[i64]) -> Result<(), String> {
    let placeholders = vec!["?"; ids.len()].join(",");
    conn.execute(
        &format!("DELETE FROM categories WHERE id IN ({placeholders})"),
        rusqlite::params_from_iter(ids.iter()),
    )
    .map_err(db_err)?;
    Ok(())
}

pub fn create_payment_method(conn: &Connection, input: &PaymentMethodInput) -> Result<(), String> {
    let name = input.name.trim();
    let dup = conn
        .query_row(
            "SELECT 1 FROM payment_methods WHERE name = ?1 LIMIT 1",
            params![name],
            |_| Ok(()),
        )
        .optional()
        .map_err(db_err)?;
    if dup.is_some() {
        return Err("já existe forma de pagamento com esse nome".into());
    }
    conn.execute(
        "INSERT INTO payment_methods (name, type, metadata) VALUES (?1, ?2, ?3)",
        params![name, input.type_, metadata_for_payment_method(input)],
    )
    .map_err(db_err)?;
    Ok(())
}

fn metadata_for_payment_method(input: &PaymentMethodInput) -> Option<String> {
    if input.type_ != 2 {
        return None;
    }
    let close = input.close_day.unwrap_or(0);
    let validity = input.validity_day.unwrap_or(0);
    Some(
        serde_json::json!({ "close_day": close, "validity_day": validity }).to_string(),
    )
}

pub(crate) fn validate_payment_method(input: &PaymentMethodInput) -> Result<(), String> {
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

pub(crate) fn update_payment_method(
    conn: &Connection,
    id: i64,
    input: &PaymentMethodInput,
) -> Result<(), String> {
    let affected = conn
        .execute(
            "UPDATE payment_methods SET name = ?1, type = ?2, metadata = ?3 WHERE id = ?4",
            params![input.name.trim(), input.type_, metadata_for_payment_method(input), id],
        )
        .map_err(db_err)?;
    if affected == 0 {
        return Err("forma de pagamento não encontrada".into());
    }
    card_bills::refresh_card_bills(conn)?;
    Ok(())
}

pub(crate) fn delete_payment_methods(conn: &Connection, ids: &[i64]) -> Result<(), String> {
    let placeholders = vec!["?"; ids.len()].join(",");
    conn.execute(
        &format!("DELETE FROM payment_methods WHERE id IN ({placeholders})"),
        rusqlite::params_from_iter(ids.iter()),
    )
    .map_err(db_err)?;
    Ok(())
}
