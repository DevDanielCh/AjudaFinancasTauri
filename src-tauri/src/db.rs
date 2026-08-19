use rusqlite::Connection;
use rusqlite_migration::{M, Migrations};
use std::fs;
use tauri::{AppHandle, Manager};

pub struct AppState {
    pub db: std::sync::Mutex<Connection>,
}

pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("../migrations/001_init.sql")),
        M::up(include_str!("../migrations/002_card_bills.sql")),
        M::up(include_str!("../migrations/003_card_bill_type.sql")),
        M::up(include_str!("../migrations/004_fixed_bill_purchase_date.sql")),
        M::up(include_str!("../migrations/005_loan_rate.sql")),
        M::up(include_str!("../migrations/006_card_debit.sql")),
        M::up(include_str!("../migrations/007_fixed_bill_end_month.sql")),
        M::up(include_str!("../migrations/008_settings.sql")),
        M::up(include_str!("../migrations/009_sync.sql")),
    ])
}

fn populate_uuids(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    let tables_with_int_pk = ["payment_methods", "categories", "fixed_bills", "loans", "transactions"];

    for table in tables_with_int_pk {
        let rows: Vec<i64> = conn
            .prepare(&format!("SELECT id FROM {table} WHERE uuid IS NULL"))?
            .query_map([], |r| r.get(0))?
            .collect::<Result<Vec<_>, _>>()?;

        let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        for row_id in rows {
            let uuid = uuid::Uuid::new_v4().to_string();
            conn.execute(
                &format!(
                    "UPDATE {table} SET uuid = ?1, created_at = COALESCE(created_at, ?2), updated_at = COALESCE(updated_at, ?2) WHERE id = ?3"
                ),
                rusqlite::params![uuid, now, row_id],
            )?;
        }
    }

    // settings uses 'key TEXT' as PK
    let rows: Vec<String> = conn
        .prepare("SELECT key FROM settings WHERE uuid IS NULL")?
        .query_map([], |r| r.get(0))?
        .collect::<Result<Vec<_>, _>>()?;

    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    for key in rows {
        let uuid = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "UPDATE settings SET uuid = ?1, created_at = COALESCE(created_at, ?2), updated_at = COALESCE(updated_at, ?2) WHERE key = ?3",
            rusqlite::params![uuid, now, key],
        )?;
    }

    Ok(())
}

pub fn open(app: &AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    fs::create_dir_all(&dir)?;
    let path = dir.join("ajudafinancas.db");
    let mut conn = Connection::open(path)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "busy_timeout", "5000")?;
    migrations().to_latest(&mut conn)?;
    populate_uuids(&conn)?;
    Ok(conn)
}

pub fn with_db<T>(
    state: &tauri::State<'_, AppState>,
    f: impl FnOnce(&Connection) -> Result<T, String>,
) -> Result<T, String> {
    let guard = state
        .db
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    f(&guard)
}
