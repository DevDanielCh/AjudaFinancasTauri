use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::shared::util::db_err;

/// Syncable entity names.
pub const SYNCABLE_ENTITIES: &[&str] = &[
    "accounts",
    "payment_methods",
    "categories",
    "fixed_bills",
    "loans",
    "transactions",
    "settings",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncOperation {
    pub id: Option<i64>,
    pub device_id: String,
    pub entity: String,
    pub entity_uuid: String,
    pub operation: String,
    pub payload: serde_json::Value,
    pub op_timestamp: String,
    pub version: i64,
    pub synced_at: Option<String>,
}

/// Columns to read for each entity (excludes local-only fields).
pub fn entity_columns(entity: &str) -> &'static str {
    match entity {
        "accounts" => "id, uuid, name, color, created_at, updated_at, deleted_at",
        "payment_methods" => "id, uuid, name, type, metadata, created_at, updated_at, deleted_at",
        "categories" => "id, uuid, name, type, color, icon, created_at, updated_at, deleted_at",
        "fixed_bills" => {
            "id, uuid, description, amount, day, category_id, payment_method_id, start_month, end_month, installments, purchase_date, created_at, updated_at, deleted_at"
        }
        "loans" => {
            "id, uuid, type, description, principal, installment, total_installments, day, start_month, payment_method_id, monthly_rate, created_at, updated_at, deleted_at"
        }
        "transactions" => {
            "id, uuid, description, amount, type, date, category_id, payment_method_id, fixed_bill_id, loan_id, bill_start, bill_end, card_mode, in_principal, created_at, updated_at, deleted_at"
        }
        "settings" => "key, uuid, value, created_at, updated_at, deleted_at",
        _ => "",
    }
}

/// Read a row as JSON for sync payload. Uses uuid instead of local id for FK references.
pub fn read_entity_row(
    conn: &Connection,
    entity: &str,
    row_id: &dyn rusqlite::types::ToSql,
) -> Result<serde_json::Value, String> {
    let sql = match entity {
        "accounts" => {
            "SELECT uuid, name, color, created_at, updated_at, deleted_at
             FROM accounts WHERE id = ?1"
        }
        "payment_methods" => {
            "SELECT pm.uuid, pm.name, pm.type, pm.metadata,
                    COALESCE(a.uuid, '') as account_uuid,
                    pm.created_at, pm.updated_at, pm.deleted_at
             FROM payment_methods pm
             LEFT JOIN accounts a ON a.id = pm.account_id
             WHERE pm.id = ?1"
        }
        "categories" => {
            "SELECT c.uuid, c.name, c.type, c.color, c.icon,
                    COALESCE(a.uuid, '') as account_uuid,
                    c.created_at, c.updated_at, c.deleted_at
             FROM categories c
             LEFT JOIN accounts a ON a.id = c.account_id
             WHERE c.id = ?1"
        }
        "fixed_bills" => {
            "SELECT fb.uuid, fb.description, fb.amount, fb.day,
                    COALESCE(c.uuid, '') as cat_uuid,
                    COALESCE(pm.uuid, '') as pm_uuid,
                    COALESCE(a.uuid, '') as account_uuid,
                    fb.start_month, fb.end_month, fb.installments, fb.purchase_date,
                    fb.created_at, fb.updated_at, fb.deleted_at
             FROM fixed_bills fb
             LEFT JOIN categories c ON c.id = fb.category_id
             LEFT JOIN payment_methods pm ON pm.id = fb.payment_method_id
             LEFT JOIN accounts a ON a.id = fb.account_id
             WHERE fb.id = ?1"
        }
        "loans" => {
            "SELECT l.uuid, l.type, l.description, l.principal, l.installment,
                    l.total_installments, l.day, l.start_month,
                    COALESCE(pm.uuid, '') as pm_uuid,
                    COALESCE(a.uuid, '') as account_uuid,
                    l.monthly_rate, l.created_at, l.updated_at, l.deleted_at
             FROM loans l
             LEFT JOIN payment_methods pm ON pm.id = l.payment_method_id
             LEFT JOIN accounts a ON a.id = l.account_id
             WHERE l.id = ?1"
        }
        "transactions" => {
            "SELECT t.uuid, t.description, t.amount, t.type, t.date,
                    COALESCE(c.uuid, '') as cat_uuid,
                    COALESCE(pm.uuid, '') as pm_uuid,
                    COALESCE(fb.uuid, '') as fb_uuid,
                    COALESCE(l.uuid, '') as loan_uuid,
                    COALESCE(a.uuid, '') as account_uuid,
                    t.bill_start, t.bill_end, t.card_mode, t.in_principal,
                    t.created_at, t.updated_at, t.deleted_at
             FROM transactions t
             LEFT JOIN categories c ON c.id = t.category_id
             LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
             LEFT JOIN fixed_bills fb ON fb.id = t.fixed_bill_id
             LEFT JOIN loans l ON l.id = t.loan_id
             LEFT JOIN accounts a ON a.id = t.account_id
             WHERE t.id = ?1"
        }
        "settings" => {
            "SELECT s.uuid, s.key, s.value,
                    COALESCE(a.uuid, '') as account_uuid,
                    s.created_at, s.updated_at, s.deleted_at
             FROM settings s
             LEFT JOIN accounts a ON a.id = s.account_id
             WHERE s.key = ?1"
        }
        _ => return Err(format!("entidade desconhecida: {entity}")),
    };

    let mut stmt = conn.prepare(sql).map_err(db_err)?;
    let columns: Vec<String> = stmt
        .column_names()
        .iter()
        .map(|s| s.to_string())
        .collect();
    let mut rows = stmt.query_map([row_id], |r| {
        let mut map = serde_json::Map::new();
        for (i, name) in columns.iter().enumerate() {
            let val: Option<String> = r.get(i).ok();
            map.insert(
                name.clone(),
                match val {
                    Some(v) => {
                        if v.is_empty() && name.ends_with("_uuid") {
                            serde_json::Value::Null
                        } else {
                            serde_json::Value::String(v)
                        }
                    }
                    None => serde_json::Value::Null,
                },
            );
        }
        Ok(serde_json::Value::Object(map))
    })
    .map_err(db_err)?;

    rows.next()
        .ok_or("registro não encontrado")?
        .map_err(db_err)
}

/// Collect all unsynced operations for a given device.
pub fn collect_unsynced(
    conn: &Connection,
    _device_id: &str,
) -> Result<Vec<SyncOperation>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, device_id, entity, entity_uuid, operation, payload, op_timestamp, version, synced_at
             FROM sync_operations
             WHERE synced_at IS NULL
             ORDER BY version ASC",
        )
        .map_err(db_err)?;

    let ops = stmt
        .query_map([], |r| {
            Ok(SyncOperation {
                id: r.get(0)?,
                device_id: r.get(1)?,
                entity: r.get(2)?,
                entity_uuid: r.get(3)?,
                operation: r.get(4)?,
                payload: serde_json::from_str(&r.get::<_, String>(5)?).unwrap_or_default(),
                op_timestamp: r.get(6)?,
                version: r.get(7)?,
                synced_at: r.get(8)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;

    Ok(ops)
}

/// Mark operations as synced.
pub fn mark_synced(conn: &Connection, ids: &[i64], timestamp: &str) -> Result<(), String> {
    if ids.is_empty() {
        return Ok(());
    }
    let placeholders = vec!["?"; ids.len()].join(",");
    conn.execute(
        &format!(
            "UPDATE sync_operations SET synced_at = ?1 WHERE id IN ({placeholders})"
        ),
        rusqlite::params_from_iter(
            std::iter::once(Box::new(timestamp.to_string()) as Box<dyn rusqlite::types::ToSql>)
                .chain(ids.iter().map(|id| Box::new(*id) as Box<dyn rusqlite::types::ToSql>)),
        ),
    )
    .map_err(db_err)?;
    Ok(())
}

/// Get the next global version number.
pub fn next_version(conn: &Connection) -> Result<i64, String> {
    conn.execute(
        "UPDATE _sync_counter SET value = value + 1 WHERE key = 'current'",
        [],
    )
    .map_err(db_err)?;
    conn.query_row(
        "SELECT value FROM _sync_counter WHERE key = 'current'",
        [],
        |r| r.get(0),
    )
    .map_err(db_err)
}

/// Get the current global version.
pub fn current_version(conn: &Connection) -> Result<i64, String> {
    conn.query_row(
        "SELECT value FROM _sync_counter WHERE key = 'current'",
        [],
        |r| r.get(0),
    )
    .map_err(db_err)
}

/// Set sync session flag (1 = sync mode, triggers skip updated_at).
pub fn set_sync_session(conn: &Connection, active: bool) -> Result<(), String> {
    let val = if active { "1" } else { "0" };
    conn.execute(
        "UPDATE _sync_config SET value = ?1 WHERE key = 'session'",
        [val],
    )
    .map_err(db_err)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sync::device;

    fn test_conn() -> rusqlite::Connection {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::migrations().to_latest(&mut conn).unwrap();
        conn
    }

    #[test]
    fn next_version_starts_at_one() {
        let conn = test_conn();
        let v = next_version(&conn).unwrap();
        assert_eq!(v, 1);
    }

    #[test]
    fn next_version_increments() {
        let conn = test_conn();
        let v1 = next_version(&conn).unwrap();
        let v2 = next_version(&conn).unwrap();
        assert_eq!(v1, 1);
        assert_eq!(v2, 2);
    }

    #[test]
    fn current_version_tracks_next() {
        let conn = test_conn();
        assert_eq!(current_version(&conn).unwrap(), 0);
        let v = next_version(&conn).unwrap();
        assert_eq!(v, 1);
        assert_eq!(current_version(&conn).unwrap(), 1);
    }

    #[test]
    fn collect_unsynced_returns_pending_ops() {
        let conn = test_conn();
        let device_id = device::get_or_create_device_id(&conn).unwrap();
        let uuid = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO sync_operations (device_id, entity, entity_uuid, operation, payload, op_timestamp, version)
             VALUES (?1, 'categories', ?2, 'INSERT', '{}', '2026-01-01T00:00:00Z', 1)",
            rusqlite::params![device_id, uuid],
        ).unwrap();

        let ops = collect_unsynced(&conn, &device_id).unwrap();
        assert_eq!(ops.len(), 1);
        assert_eq!(ops[0].entity, "categories");
        assert_eq!(ops[0].operation, "INSERT");
    }

    #[test]
    fn collect_unsynced_excludes_synced() {
        let conn = test_conn();
        let device_id = device::get_or_create_device_id(&conn).unwrap();
        let uuid = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO sync_operations (device_id, entity, entity_uuid, operation, payload, op_timestamp, version, synced_at)
             VALUES (?1, 'categories', ?2, 'INSERT', '{}', '2026-01-01T00:00:00Z', 1, '2026-01-02T00:00:00Z')",
            rusqlite::params![device_id, uuid],
        ).unwrap();

        let ops = collect_unsynced(&conn, &device_id).unwrap();
        assert!(ops.is_empty());
    }

    #[test]
    fn mark_synced_updates_timestamp() {
        let conn = test_conn();
        let device_id = device::get_or_create_device_id(&conn).unwrap();
        let uuid = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO sync_operations (device_id, entity, entity_uuid, operation, payload, op_timestamp, version)
             VALUES (?1, 'categories', ?2, 'INSERT', '{}', '2026-01-01T00:00:00Z', 1)",
            rusqlite::params![device_id, uuid],
        ).unwrap();

        let ops = collect_unsynced(&conn, &device_id).unwrap();
        let ids: Vec<i64> = ops.iter().filter_map(|o| o.id).collect();
        mark_synced(&conn, &ids, "2026-06-01T00:00:00Z").unwrap();

        let remaining = collect_unsynced(&conn, &device_id).unwrap();
        assert!(remaining.is_empty());
    }

    #[test]
    fn mark_synced_empty_ids_is_noop() {
        let conn = test_conn();
        mark_synced(&conn, &[], "2026-01-01T00:00:00Z").unwrap();
    }

    #[test]
    fn set_sync_session_toggles_flag() {
        let conn = test_conn();
        set_sync_session(&conn, true).unwrap();
        let val: String = conn
            .query_row("SELECT value FROM _sync_config WHERE key = 'session'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(val, "1");

        set_sync_session(&conn, false).unwrap();
        let val: String = conn
            .query_row("SELECT value FROM _sync_config WHERE key = 'session'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(val, "0");
    }

    #[test]
    fn entity_columns_covers_all_entities() {
        for entity in SYNCABLE_ENTITIES {
            let cols = entity_columns(entity);
            assert!(!cols.is_empty(), "missing columns for {entity}");
        }
    }
}
