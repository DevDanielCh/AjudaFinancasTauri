use rusqlite::Connection;
use rusqlite_migration::{M, Migrations};
use std::fs;
use tauri::{AppHandle, Manager};

pub struct AppState {
    pub db: std::sync::Mutex<Connection>,
}

pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![M::up(include_str!("../migrations/001_init.sql"))])
}

pub fn open(app: &AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    fs::create_dir_all(&dir)?;
    let path = dir.join("ajudafinancas.db");
    let mut conn = Connection::open(path)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrations().to_latest(&mut conn)?;
    Ok(conn)
}

pub fn with_db<T>(
    state: &tauri::State<'_, AppState>,
    f: impl FnOnce(&Connection) -> Result<T, String>,
) -> Result<T, String> {
    let guard = state
        .db
        .lock()
        .map_err(|_| "banco de dados bloqueado".to_string())?;
    f(&guard)
}
