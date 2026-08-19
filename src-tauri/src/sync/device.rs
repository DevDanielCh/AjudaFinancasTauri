use rusqlite::Connection;
use std::path::PathBuf;

use crate::shared::util::db_err;

#[derive(Debug, Clone)]
pub struct DeviceInfo {
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub created_at: String,
}

pub fn get_or_create_device_id(conn: &Connection) -> Result<String, String> {
    if let Ok(id) = conn.query_row(
        "SELECT value FROM settings WHERE key = '_device_id'",
        [],
        |r| r.get::<_, String>(0),
    ) {
        return Ok(id);
    }

    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('_device_id', ?1)",
        rusqlite::params![id],
    )
    .map_err(db_err)?;
    Ok(id)
}

pub fn get_device_name() -> String {
    hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown-device".to_string())
}

pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

pub fn register_device(conn: &Connection, device_id: &str) -> Result<(), String> {
    let name = get_device_name();
    let platform = get_platform();
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    conn.execute(
        "INSERT OR IGNORE INTO device_registry (device_id, device_name, created_at, platform)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![device_id, name, now, platform],
    )
    .map_err(db_err)?;
    Ok(())
}

pub fn get_database_id(conn: &Connection) -> Result<String, String> {
    if let Ok(id) = conn.query_row(
        "SELECT value FROM settings WHERE key = '_database_id'",
        [],
        |r| r.get::<_, String>(0),
    ) {
        return Ok(id);
    }

    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('_database_id', ?1)",
        rusqlite::params![id],
    )
    .map_err(db_err)?;
    Ok(id)
}

pub fn get_local_sync_version(conn: &Connection) -> Result<i64, String> {
    conn.query_row(
        "SELECT last_sync_version FROM sync_state WHERE device_id = (SELECT value FROM settings WHERE key = '_device_id')",
        [],
        |r| r.get(0),
    )
    .map_err(|_| "sem estado de sync".to_string())
}

pub fn upsert_sync_state(
    conn: &Connection,
    device_id: &str,
    database_id: &str,
    version: i64,
) -> Result<(), String> {
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    conn.execute(
        "INSERT INTO sync_state (device_id, database_id, last_sync_version, last_sync_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(device_id) DO UPDATE SET
           last_sync_version = excluded.last_sync_version,
           last_sync_at = excluded.last_sync_at",
        rusqlite::params![device_id, database_id, version, now],
    )
    .map_err(db_err)?;
    Ok(())
}

pub fn get_device_app_data_dir() -> Option<PathBuf> {
    dirs::data_local_dir().map(|d| d.join("ajudafinancas"))
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
    fn get_or_create_device_id_persists() {
        let conn = test_conn();
        let id1 = get_or_create_device_id(&conn).unwrap();
        let id2 = get_or_create_device_id(&conn).unwrap();
        assert_eq!(id1, id2, "device_id must be stable across calls");
    }

    #[test]
    fn get_database_id_persists() {
        let conn = test_conn();
        let id1 = get_database_id(&conn).unwrap();
        let id2 = get_database_id(&conn).unwrap();
        assert_eq!(id1, id2, "database_id must be stable across calls");
    }

    #[test]
    fn device_id_and_database_id_are_different() {
        let conn = test_conn();
        let dev = get_or_create_device_id(&conn).unwrap();
        let db = get_database_id(&conn).unwrap();
        assert_ne!(dev, db);
    }

    #[test]
    fn register_device_is_idempotent() {
        let conn = test_conn();
        let id = get_or_create_device_id(&conn).unwrap();
        register_device(&conn, &id).unwrap();
        register_device(&conn, &id).unwrap();
    }

    #[test]
    fn get_device_name_returns_nonempty() {
        let name = get_device_name();
        assert!(!name.is_empty());
    }

    #[test]
    fn get_platform_returns_nonempty() {
        let p = get_platform();
        assert!(!p.is_empty());
    }
}
