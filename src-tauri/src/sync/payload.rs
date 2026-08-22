use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::shared::util::db_err;



/// Represents the full state of syncable data for snapshots.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotData {
    pub accounts: Vec<serde_json::Value>,
    pub payment_methods: Vec<serde_json::Value>,
    pub categories: Vec<serde_json::Value>,
    pub fixed_bills: Vec<serde_json::Value>,
    pub loans: Vec<serde_json::Value>,
    pub transactions: Vec<serde_json::Value>,
    pub settings: Vec<serde_json::Value>,
}

/// Serialize all syncable data from local DB into a snapshot.
pub fn serialize_local_data(conn: &Connection) -> Result<SnapshotData, String> {
    Ok(SnapshotData {
        accounts: read_all_syncable(conn, "accounts")?,
        payment_methods: read_all_syncable(conn, "payment_methods")?,
        categories: read_all_syncable(conn, "categories")?,
        fixed_bills: read_all_syncable(conn, "fixed_bills")?,
        loans: read_all_syncable(conn, "loans")?,
        transactions: read_all_syncable(conn, "transactions")?,
        settings: read_all_syncable(conn, "settings")?,
    })
}

/// Read all non-deleted rows from a syncable entity as JSON values.
fn read_all_syncable(conn: &Connection, entity: &str) -> Result<Vec<serde_json::Value>, String> {
    let (sql, _id_col) = match entity {
        "accounts" => (
            "SELECT uuid, name, color, created_at, updated_at, deleted_at
             FROM accounts WHERE deleted_at IS NULL",
            "uuid",
        ),
        "payment_methods" => (
            "SELECT pm.uuid, pm.name, pm.type, pm.metadata,
                    COALESCE(a.uuid, '') as account_uuid,
                    pm.created_at, pm.updated_at, pm.deleted_at
             FROM payment_methods pm
             LEFT JOIN accounts a ON a.id = pm.account_id
             WHERE pm.deleted_at IS NULL",
            "uuid",
        ),
        "categories" => (
            "SELECT c.uuid, c.name, c.type, c.color, c.icon,
                    COALESCE(a.uuid, '') as account_uuid,
                    c.created_at, c.updated_at, c.deleted_at
             FROM categories c
             LEFT JOIN accounts a ON a.id = c.account_id
             WHERE c.deleted_at IS NULL",
            "uuid",
        ),
        "fixed_bills" => (
            "SELECT fb.uuid, fb.description, fb.amount, fb.day,
                    COALESCE(c.uuid, '') as category_uuid,
                    COALESCE(pm.uuid, '') as payment_method_uuid,
                    COALESCE(a.uuid, '') as account_uuid,
                    fb.start_month, fb.end_month, fb.installments, fb.purchase_date,
                    fb.created_at, fb.updated_at, fb.deleted_at
             FROM fixed_bills fb
             LEFT JOIN categories c ON c.id = fb.category_id
             LEFT JOIN payment_methods pm ON pm.id = fb.payment_method_id
             LEFT JOIN accounts a ON a.id = fb.account_id
             WHERE fb.deleted_at IS NULL",
            "uuid",
        ),
        "loans" => (
            "SELECT l.uuid, l.type, l.description, l.principal, l.installment,
                    l.total_installments, l.day, l.start_month,
                    COALESCE(pm.uuid, '') as payment_method_uuid,
                    COALESCE(a.uuid, '') as account_uuid,
                    l.monthly_rate, l.created_at, l.updated_at, l.deleted_at
             FROM loans l
             LEFT JOIN payment_methods pm ON pm.id = l.payment_method_id
             LEFT JOIN accounts a ON a.id = l.account_id
             WHERE l.deleted_at IS NULL",
            "uuid",
        ),
        "transactions" => (
            "SELECT t.uuid, t.description, t.amount, t.type, t.date,
                    COALESCE(c.uuid, '') as category_uuid,
                    COALESCE(pm.uuid, '') as payment_method_uuid,
                    COALESCE(fb.uuid, '') as fixed_bill_uuid,
                    COALESCE(l.uuid, '') as loan_uuid,
                    COALESCE(a.uuid, '') as account_uuid,
                    t.bill_start, t.bill_end, t.card_mode,
                    t.created_at, t.updated_at, t.deleted_at
             FROM transactions t
             LEFT JOIN categories c ON c.id = t.category_id
             LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
             LEFT JOIN fixed_bills fb ON fb.id = t.fixed_bill_id
             LEFT JOIN loans l ON l.id = t.loan_id
             LEFT JOIN accounts a ON a.id = t.account_id
             WHERE t.deleted_at IS NULL
               AND t.bill_start IS NULL
               AND t.fixed_bill_id IS NULL
               AND (t.loan_id IS NULL OR t.type != 2)",
            "uuid",
        ),
        "settings" => (
            "SELECT s.uuid, s.key, s.value,
                    COALESCE(a.uuid, '') as account_uuid,
                    s.created_at, s.updated_at, s.deleted_at
             FROM settings s
             LEFT JOIN accounts a ON a.id = s.account_id
             WHERE s.deleted_at IS NULL
               AND s.key NOT LIKE '\\_' || '%' ESCAPE '\\'",
            "key",
        ),
        _ => return Err(format!("entidade desconhecida: {entity}")),
    };

    let mut stmt = conn.prepare(sql).map_err(db_err)?;
    let columns: Vec<String> = stmt
        .column_names()
        .iter()
        .map(|s| s.to_string())
        .collect();
    let rows = stmt
        .query_map([], |r| {
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

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(db_err)?);
    }
    Ok(out)
}

/// Resolve a UUID to a local integer ID for a given entity.
pub fn resolve_local_id(conn: &Connection, entity: &str, uuid: &str) -> Result<Option<i64>, String> {
    if uuid.is_empty() {
        return Ok(None);
    }
    let sql = match entity {
        "accounts" => "SELECT id FROM accounts WHERE uuid = ?1 AND deleted_at IS NULL",
        "categories" => "SELECT id FROM categories WHERE uuid = ?1 AND deleted_at IS NULL",
        "payment_methods" => {
            "SELECT id FROM payment_methods WHERE uuid = ?1 AND deleted_at IS NULL"
        }
        "fixed_bills" => "SELECT id FROM fixed_bills WHERE uuid = ?1 AND deleted_at IS NULL",
        "loans" => "SELECT id FROM loans WHERE uuid = ?1 AND deleted_at IS NULL",
        _ => return Ok(None),
    };
    conn.query_row(sql, rusqlite::params![uuid], |r| r.get(0))
        .optional()
        .map_err(db_err)
}

use rusqlite::OptionalExtension;

#[cfg(test)]
mod tests {
    use super::*;

    fn test_conn() -> rusqlite::Connection {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::migrations().to_latest(&mut conn).unwrap();
        conn
    }

    #[test]
    fn serialize_empty_db_returns_empty_snapshot() {
        let conn = test_conn();
        let snap = serialize_local_data(&conn).unwrap();
        assert_eq!(snap.categories.len(), 0);
        assert_eq!(snap.fixed_bills.len(), 0);
        assert_eq!(snap.loans.len(), 0);
        assert_eq!(snap.transactions.len(), 0);
    }

    #[test]
    fn serialize_categories_with_uuid() {
        let conn = test_conn();
        let uuid = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO categories (uuid, name, type, color, icon) VALUES (?1, 'Food', 1, '#ff0000', 'utensils')",
            rusqlite::params![uuid],
        ).unwrap();

        let snap = serialize_local_data(&conn).unwrap();
        assert_eq!(snap.categories.len(), 1);
        assert_eq!(snap.categories[0]["uuid"].as_str().unwrap(), uuid);
        assert_eq!(snap.categories[0]["name"].as_str().unwrap(), "Food");
    }

    #[test]
    fn serialize_excludes_deleted_rows() {
        let conn = test_conn();
        let uuid = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO categories (uuid, name, type, color, icon, deleted_at) VALUES (?1, 'Del', 1, '#000', 'x', '2026-01-01T00:00:00Z')",
            rusqlite::params![uuid],
        ).unwrap();

        let snap = serialize_local_data(&conn).unwrap();
        assert!(snap.categories.is_empty());
    }

    #[test]
    fn serialize_excludes_sync_config_keys() {
        let conn = test_conn();
        // Insert a sync config key directly
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('_test_sync_key', 'test_value')",
            [],
        ).unwrap();
        // Insert a normal setting
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('primeiro_mes', '2026-01')",
            [],
        ).unwrap();

        let snap = serialize_local_data(&conn).unwrap();
        for s in &snap.settings {
            let k = s["key"].as_str().unwrap_or("");
            assert!(!k.starts_with('_'), "sync config key {k} should not appear in snapshot");
        }
    }

    #[test]
    fn resolve_local_id_empty_uuid_returns_none() {
        let conn = test_conn();
        let result = resolve_local_id(&conn, "categories", "").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn resolve_local_id_returns_id_for_existing_uuid() {
        let conn = test_conn();
        let uuid = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO categories (uuid, name, type, color, icon) VALUES (?1, 'Test', 1, '#000', 'x')",
            rusqlite::params![uuid],
        ).unwrap();

        let id = resolve_local_id(&conn, "categories", &uuid).unwrap();
        assert!(id.is_some());
    }

    #[test]
    fn resolve_local_id_none_for_nonexistent_uuid() {
        let conn = test_conn();
        let result = resolve_local_id(&conn, "categories", "no-such-uuid").unwrap();
        assert!(result.is_none());
    }
}
