use rusqlite::{params, Connection, OptionalExtension};

use super::models::AccountRow;
use crate::shared::util::db_err;

pub const META_ACTIVE_KEY: &str = "active_account_id";
/// Chaves de sistema (prefixo _) vivem fora de qualquer conta.
pub const SYSTEM_ACCOUNT_ID: i64 = 0;

pub fn list(conn: &Connection) -> Result<Vec<AccountRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, uuid, name, color, created_at
             FROM accounts WHERE deleted_at IS NULL ORDER BY id",
        )
        .map_err(db_err)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(AccountRow {
                id: r.get(0)?,
                uuid: r.get(1)?,
                name: r.get(2)?,
                color: r.get(3)?,
                created_at: r.get(4)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(rows)
}

pub fn get_by_uuid(conn: &Connection, uuid: &str) -> Result<Option<AccountRow>, String> {
    conn.query_row(
        "SELECT id, uuid, name, color, created_at
         FROM accounts WHERE uuid = ?1 AND deleted_at IS NULL",
        params![uuid],
        |r| {
            Ok(AccountRow {
                id: r.get(0)?,
                uuid: r.get(1)?,
                name: r.get(2)?,
                color: r.get(3)?,
                created_at: r.get(4)?,
            })
        },
    )
    .optional()
    .map_err(db_err)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<AccountRow>, String> {
    conn.query_row(
        "SELECT id, uuid, name, color, created_at
         FROM accounts WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
        |r| {
            Ok(AccountRow {
                id: r.get(0)?,
                uuid: r.get(1)?,
                name: r.get(2)?,
                color: r.get(3)?,
                created_at: r.get(4)?,
            })
        },
    )
    .optional()
    .map_err(db_err)
}

pub fn first_id(conn: &Connection) -> Result<i64, String> {
    conn.query_row(
        "SELECT id FROM accounts WHERE deleted_at IS NULL ORDER BY id LIMIT 1",
        [],
        |r| r.get(0),
    )
    .map_err(|_| "nenhuma conta encontrada".to_string())
}

pub fn count(conn: &Connection) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM accounts WHERE deleted_at IS NULL",
        [],
        |r| r.get(0),
    )
    .map_err(db_err)
}

pub struct NewAccount<'a> {
    pub name: &'a str,
    pub color: &'a str,
}

/// Insere a conta (uuid preenchido pelo caller ou trigger de populate).
pub fn insert(
    conn: &Connection,
    account: &NewAccount,
    now: &str,
) -> Result<(i64, String), String> {
    let uuid = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO accounts (name, color, uuid, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![account.name, account.color, uuid, now, now],
    )
    .map_err(db_err)?;
    Ok((conn.last_insert_rowid(), uuid))
}

pub fn update(conn: &Connection, id: i64, name: &str, color: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE accounts SET name = ?1, color = ?2, updated_at = datetime('now') WHERE id = ?3",
        params![name, color, id],
    )
    .map_err(db_err)?;
    Ok(())
}

/// Soft-delete da conta e hard-delete dos dados dela (transação do caller).
pub fn soft_delete(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE accounts SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(db_err)?;
    Ok(())
}

pub fn get_active_meta(conn: &Connection) -> Result<Option<i64>, String> {
    let v: Option<String> = conn
        .query_row(
            "SELECT value FROM _accounts_meta WHERE key = ?1",
            params![META_ACTIVE_KEY],
            |r| r.get::<_, String>(0),
        )
        .optional()
        .map_err(db_err)?;
    match v {
        Some(s) => s.parse::<i64>().map(Some).map_err(|_| "meta de conta ativa corrompida".to_string()),
        None => Ok(None),
    }
}

pub fn set_active_meta(conn: &Connection, account_id: i64) -> Result<(), String> {
    conn.execute(
        "INSERT INTO _accounts_meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![META_ACTIVE_KEY, account_id.to_string()],
    )
    .map_err(db_err)?;
    Ok(())
}
