use rusqlite::Connection;

use super::repository;
use super::models::{validate_color, validate_name, AccountInfo, AccountInput, AccountRow};
use crate::shared::util::db_err;

/// Garante que exista ao menos uma conta (usado na abertura do banco).
pub fn ensure_default_account(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM accounts WHERE deleted_at IS NULL", [], |r| r.get(0))
        .map_err(db_err)
        .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
    if count == 0 {
        repository::insert(
            conn,
            &repository::NewAccount { name: "Pessoal", color: "#5865f2" },
            &chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        )
        .map_err(db_err)
        .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
    }
    Ok(())
}

fn to_info(conn: &Connection, row: &AccountRow) -> Result<AccountInfo, String> {
    let active_id = active_id(conn)?;
    Ok(AccountInfo {
        uuid: row.uuid.clone().unwrap_or_default(),
        name: row.name.clone(),
        color: row.color.clone(),
        created_at: row.created_at.clone().unwrap_or_default(),
        active: row.id == active_id,
        id: row.id,
    })
}

/// Id da conta ativa; cai para a primeira conta se a meta apontar para conta excluída.
pub fn active_id(conn: &Connection) -> Result<i64, String> {
    if let Some(id) = repository::get_active_meta(conn)? {
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM accounts WHERE id = ?1 AND deleted_at IS NULL",
                rusqlite::params![id],
                |r| r.get(0),
            )
            .map_err(db_err)?;
        if exists {
            return Ok(id);
        }
    }
    let first = repository::first_id(conn)?;
    repository::set_active_meta(conn, first)?;
    Ok(first)
}

pub fn list(conn: &Connection) -> Result<Vec<AccountInfo>, String> {
    let rows = repository::list(conn)?;
    rows.iter().map(|r| to_info(conn, r)).collect()
}

pub fn get_active(conn: &Connection) -> Result<AccountInfo, String> {
    let id = active_id(conn)?;
    let row = repository::get_by_id(conn, id)?.ok_or("conta ativa não encontrada")?;
    to_info(conn, &row)
}

pub fn create(conn: &Connection, input: &AccountInput) -> Result<AccountInfo, String> {
    let name = input.name.as_deref().map(str::trim).unwrap_or_default();
    validate_name(name)?;
    let color = input.color.as_deref().unwrap_or("#5865f2");
    validate_color(color)?;

    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let (id, _uuid) = repository::insert(
        conn,
        &repository::NewAccount { name, color },
        &now,
    )?;

    // Nova conta criada já se torna ativa (fluxo Discord).
    repository::set_active_meta(conn, id)?;
    let row = repository::get_by_id(conn, id)?.ok_or("falha ao ler conta criada")?;
    to_info(conn, &row)
}

pub fn update(conn: &Connection, uuid: &str, input: &AccountInput) -> Result<(), String> {
    let row = repository::get_by_uuid(conn, uuid)?.ok_or("conta não encontrada")?;

    let name = input.name.as_deref().unwrap_or(&row.name);
    validate_name(name.trim())?;
    let color = input.color.as_deref().unwrap_or(&row.color);
    validate_color(color)?;

    repository::update(conn, row.id, name.trim(), color)
}

/// Exclui a conta e TODOS os dados dela. A última conta não pode ser excluída.
/// Se a ativa for excluída, ativa a primeira restante.
pub fn delete(conn: &Connection, uuid: &str) -> Result<AccountInfo, String> {
    let row = repository::get_by_uuid(conn, uuid)?.ok_or("conta não encontrada")?;
    if repository::count(conn)? <= 1 {
        return Err("não é possível excluir a última conta".into());
    }

    let was_active = active_id(conn)? == row.id;

    // Soft-delete da conta + remoção dos dados (ops de sync são logadas pelos triggers
    // existentes? Não — deletes em massa são diretos; sync reconcilia via snapshot).
    conn.execute("BEGIN IMMEDIATE", []).map_err(db_err)?;
    let result = (|| {
        repository::soft_delete(conn, row.id)?;
        for sql in [
            "DELETE FROM transactions WHERE account_id = ?1",
            "DELETE FROM fixed_bills WHERE account_id = ?1",
            "DELETE FROM loans WHERE account_id = ?1",
            "DELETE FROM categories WHERE account_id = ?1",
            "DELETE FROM payment_methods WHERE account_id = ?1",
        ] {
            conn.execute(sql, rusqlite::params![row.id]).map_err(db_err)?;
        }
        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute("COMMIT", []).map_err(db_err)?;
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            return Err(e);
        }
    }

    if was_active {
        let next = repository::first_id(conn)?;
        repository::set_active_meta(conn, next)?;
    }

    get_active(conn)
}

pub fn switch(conn: &Connection, uuid: &str) -> Result<AccountInfo, String> {
    let row = repository::get_by_uuid(conn, uuid)?.ok_or("conta não encontrada")?;
    repository::set_active_meta(conn, row.id)?;
    to_info(conn, &row)
}
