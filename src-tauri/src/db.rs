use rusqlite::Connection;
use rusqlite_migration::{M, Migrations};
use std::fs;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
    /// Conta ativa (estilo "servidor" do Discord). Trocada via set_active_account.
    pub active_account: Mutex<i64>,
}

impl AppState {
    pub fn active(&self) -> i64 {
        *self
            .active_account
            .lock()
            .unwrap_or_else(|p| p.into_inner())
    }

    /// Atualiza o cache da conta ativa após create/switch/delete.
    pub fn set_active(&self, id: i64) {
        let mut guard = self
            .active_account
            .lock()
            .unwrap_or_else(|p| p.into_inner());
        *guard = id;
    }
}

/// Executa `f` com a conexão e o id da conta ativa.
pub fn with_db_active<T>(
    state: &tauri::State<'_, AppState>,
    f: impl FnOnce(&Connection, i64) -> Result<T, String>,
) -> Result<T, String> {
    let guard = state
        .db
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    f(&guard, state.active())
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
        M::up(include_str!("../migrations/010_accounts.sql")),
        M::up(include_str!("../migrations/011_in_principal.sql")),
    ])
}

fn populate_uuids(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    let tables_with_int_pk = [
        "accounts",
        "payment_methods",
        "categories",
        "fixed_bills",
        "loans",
        "transactions",
    ];

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

    // settings usa PK composta (account_id, key)
    let rows: Vec<(i64, String)> = conn
        .prepare("SELECT account_id, key FROM settings WHERE uuid IS NULL")?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<Result<Vec<_>, _>>()?;

    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    for (account_id, key) in rows {
        let uuid = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "UPDATE settings SET uuid = ?1, created_at = COALESCE(created_at, ?2), updated_at = COALESCE(updated_at, ?2)
             WHERE account_id = ?3 AND key = ?4",
            rusqlite::params![uuid, now, account_id, key],
        )?;
    }

    Ok(())
}

/// Abre o banco do app (app_data_dir/ajudafinancas.db), aplica migrations,
/// garante a conta padrão e popula UUIDs.
pub fn open(app: &tauri::AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    use tauri::Manager;
    let dir = app.path().app_data_dir()?;
    fs::create_dir_all(&dir)?;
    let path = dir.join("ajudafinancas.db");
    open_path(&path)
}

/// Abre (ou cria) o banco em `path`, aplicando migrations e populando UUIDs.
pub fn open_path(path: &std::path::Path) -> Result<Connection, Box<dyn std::error::Error>> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut conn = Connection::open(path)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "busy_timeout", "5000")?;
    migrations().to_latest(&mut conn)?;
    populate_uuids(&conn)?;
    crate::accounts::service::ensure_default_account(&conn)?;
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
