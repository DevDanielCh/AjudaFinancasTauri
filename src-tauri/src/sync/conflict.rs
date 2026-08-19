use rusqlite::OptionalExtension;
use rusqlite::Connection;

use crate::shared::util::db_err;

pub fn should_apply_remote(
    conn: &Connection,
    entity: &str,
    entity_uuid: &str,
    op_timestamp: &str,
) -> Result<bool, String> {
    let id_col = if entity == "settings" { "key" } else { "uuid" };
    let local_ts: Option<String> = conn
        .query_row(
            &format!(
                "SELECT updated_at FROM {entity} WHERE {id_col} = ?1 AND deleted_at IS NULL"
            ),
            rusqlite::params![entity_uuid],
            |r| r.get(0),
        )
        .optional()
        .map_err(db_err)?;

    match local_ts {
        None => Ok(true),
        Some(local) => Ok(op_timestamp >= local.as_str()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrations().to_latest(&mut conn).unwrap();
        conn
    }

    #[test]
    fn apply_when_no_local_row() {
        let conn = test_conn();
        let result = should_apply_remote(&conn, "categories", "nonexistent-uuid", "2026-01-01T00:00:00Z").unwrap();
        assert!(result);
    }

    #[test]
    fn apply_when_remote_is_newer() {
        let conn = test_conn();
        let uuid = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO categories (uuid, name, type, color, icon, created_at, updated_at) VALUES (?1, 'Food', 1, '#ff0000', 'utensils', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            rusqlite::params![uuid],
        ).unwrap();

        let result = should_apply_remote(&conn, "categories", &uuid, "2026-06-01T00:00:00Z").unwrap();
        assert!(result, "remote is newer, should apply");
    }

    #[test]
    fn reject_when_local_is_newer() {
        let conn = test_conn();
        let uuid = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO categories (uuid, name, type, color, icon, created_at, updated_at) VALUES (?1, 'Food', 1, '#ff0000', 'utensils', '2026-06-01T00:00:00Z', '2026-06-01T00:00:00Z')",
            rusqlite::params![uuid],
        ).unwrap();

        let result = should_apply_remote(&conn, "categories", &uuid, "2026-01-01T00:00:00Z").unwrap();
        assert!(!result, "remote is older, should reject");
    }

    #[test]
    fn apply_when_same_timestamp() {
        let conn = test_conn();
        let uuid = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO categories (uuid, name, type, color, icon, created_at, updated_at) VALUES (?1, 'Food', 1, '#ff0000', 'utensils', '2026-01-01T00:00:00Z', '2026-03-15T12:00:00Z')",
            rusqlite::params![uuid],
        ).unwrap();

        let result = should_apply_remote(&conn, "categories", &uuid, "2026-03-15T12:00:00Z").unwrap();
        assert!(result, "same timestamp should apply (>=)");
    }
}
