use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};

use crate::sync::conflict;
use crate::sync::device;
use crate::sync::operations;
use crate::sync::payload;
use crate::sync::provider::DriveProvider;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub database_id: String,
    pub schema_version: u32,
    pub created_at: String,
    pub encryption: EncryptionMeta,
    pub devices: Vec<DeviceMeta>,
    pub latest_version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionMeta {
    pub enabled: bool,
    pub algorithm: String,
    pub kdf: String,
    pub encrypted_dek: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceMeta {
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub last_sync_version: i64,
    pub last_sync_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteOperations {
    pub database_id: String,
    pub start_version: i64,
    pub end_version: i64,
    pub operations: Vec<operations::SyncOperation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteSnapshot {
    pub database_id: String,
    pub created_at: String,
    pub version: i64,
    pub data: payload::SnapshotData,
}

#[derive(Debug, Clone)]
pub enum SyncStatus {
    Disconnected,
    Synced { at: String },
    Syncing,
    Error(String),
    Offline,
}

pub struct SyncEngine<P: DriveProvider> {
    pub drive: P,
    pub client_id: String,
    pub passphrase: Option<String>,
}

impl<P: DriveProvider> SyncEngine<P> {
    const SCHEMA_VERSION: u32 = 9;
    #[allow(dead_code)]
    const DRIVE_FOLDER: &'static str = "ajudafinancas";
    #[allow(dead_code)]
    const OPS_PER_FILE: i64 = 1000;

    pub fn new(drive: P, client_id: String, passphrase: Option<String>) -> Self {
        Self {
            drive,
            client_id,
            passphrase,
        }
    }

    fn manifest_path(database_id: &str) -> String {
        format!("{}/manifest.json", database_id)
    }

    #[allow(dead_code)]
    fn ops_path(database_id: &str, start_version: i64, has_passphrase: bool) -> String {
        format!(
            "{}/operations/ops_{:06}.json.gz{}",
            database_id,
            start_version,
            if has_passphrase { ".enc" } else { "" }
        )
    }

    fn snapshot_path(database_id: &str) -> String {
        format!("{}/snapshots/snapshot.json.gz", database_id)
    }

    fn compress(data: &[u8]) -> Result<Vec<u8>, String> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder
            .write_all(data)
            .map_err(|e| format!("falha ao comprimir: {e}"))?;
        encoder
            .finish()
            .map_err(|e| format!("falha ao finalizar compressão: {e}"))
    }

    fn decompress(data: &[u8]) -> Result<Vec<u8>, String> {
        let mut decoder = GzDecoder::new(data);
        let mut output = Vec::new();
        decoder
            .read_to_end(&mut output)
            .map_err(|e| format!("falha ao descomprimir: {e}"))?;
        Ok(output)
    }

    fn encrypt_data(&self, data: &[u8]) -> Result<Vec<u8>, String> {
        if let Some(ref pass) = self.passphrase {
            super::crypto::encrypt(data, pass).map_err(|e| e.to_string())
        } else {
            Ok(data.to_vec())
        }
    }

    fn decrypt_data(&self, data: &[u8]) -> Result<Vec<u8>, String> {
        if let Some(ref pass) = self.passphrase {
            if super::crypto::is_encrypted(data) {
                return super::crypto::decrypt(data, pass).map_err(|e| e.to_string());
            }
        }
        Ok(data.to_vec())
    }

    async fn load_or_create_manifest(
        &self,
        conn: &Connection,
    ) -> Result<Manifest, String> {
        let database_id = device::get_database_id(conn)?;
        let device_id = device::get_or_create_device_id(conn)?;

        if let Ok(data) = self.drive.download(&Self::manifest_path(&database_id)).await {
            let decrypted = self.decrypt_data(&data)?;
            let decompressed = Self::decompress(&decrypted)?;
            let manifest: Manifest =
                serde_json::from_slice(&decompressed).map_err(|e| e.to_string())?;
            return Ok(manifest);
        }

        let now = chrono::Utc::now()
            .format("%Y-%m-%dT%H:%M:%SZ")
            .to_string();
        let manifest = Manifest {
            database_id: database_id.clone(),
            schema_version: Self::SCHEMA_VERSION,
            created_at: now.clone(),
            encryption: EncryptionMeta {
                enabled: self.passphrase.is_some(),
                algorithm: "xchacha20-poly1305".into(),
                kdf: "argon2id".into(),
                encrypted_dek: None,
            },
            devices: vec![DeviceMeta {
                device_id,
                device_name: device::get_device_name(),
                platform: device::get_platform(),
                last_sync_version: 0,
                last_sync_at: now,
            }],
            latest_version: 0,
        };

        let json =
            serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
        let compressed = Self::compress(json.as_bytes())?;
        let encrypted = self.encrypt_data(&compressed)?;

        self.drive
            .upload(
                &Self::manifest_path(&database_id),
                &encrypted,
                "application/json",
            )
            .await
            .map_err(|e| e.to_string())?;

        Ok(manifest)
    }

    async fn save_manifest(&self, manifest: &Manifest) -> Result<(), String> {
        let json =
            serde_json::to_string_pretty(manifest).map_err(|e| e.to_string())?;
        let compressed = Self::compress(json.as_bytes())?;
        let encrypted = self.encrypt_data(&compressed)?;

        self.drive
            .upload(
                &Self::manifest_path(&manifest.database_id),
                &encrypted,
                "application/json",
            )
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn push(&mut self, conn: &Connection) -> Result<i64, String> {
        if !self.drive.is_authenticated().await {
            return Err("não autenticado com Google".into());
        }

        let mut manifest = self.load_or_create_manifest(conn).await?;
        let device_id = device::get_or_create_device_id(conn)?;
        let unsynced = operations::collect_unsynced(conn, &device_id)?;

        if unsynced.is_empty() {
            return Ok(manifest.latest_version);
        }

        let batch_start = manifest.latest_version + 1;
        let mut batch_version = batch_start;

        for op in &unsynced {
            let version = operations::next_version(conn)?;
            conn.execute(
                "UPDATE sync_operations SET version = ?1 WHERE id = ?2",
                rusqlite::params![version, op.id],
            )
            .map_err(|e| e.to_string())?;
            batch_version = version;
        }

        let mut sync_ops = unsynced.clone();
        for op in &mut sync_ops {
            if op.version == 0 {
                let v: i64 = conn
                    .query_row(
                        "SELECT version FROM sync_operations WHERE id = ?1",
                        rusqlite::params![op.id],
                        |r| r.get(0),
                    )
                    .map_err(|e| e.to_string())?;
                op.version = v;
            }
        }

        let remote_ops = RemoteOperations {
            database_id: manifest.database_id.clone(),
            start_version: batch_start,
            end_version: batch_version,
            operations: sync_ops,
        };

        let json =
            serde_json::to_string(&remote_ops).map_err(|e| e.to_string())?;
        let compressed = Self::compress(json.as_bytes())?;
        let encrypted = self.encrypt_data(&compressed)?;

        let path = format!(
            "{}/operations/ops_{:06}.json.gz{}",
            manifest.database_id,
            batch_start,
            if self.passphrase.is_some() {
                ".enc"
            } else {
                ""
            }
        );

        self.drive
            .upload(&path, &encrypted, "application/json")
            .await
            .map_err(|e| e.to_string())?;

        let now = chrono::Utc::now()
            .format("%Y-%m-%dT%H:%M:%SZ")
            .to_string();
        let ids: Vec<i64> = unsynced.iter().filter_map(|op| op.id).collect();
        operations::mark_synced(conn, &ids, &now)?;

        manifest.latest_version = batch_version;
        if let Some(d) = manifest.devices.iter_mut().find(|d| d.device_id == device_id) {
            d.last_sync_version = batch_version;
            d.last_sync_at = now.clone();
        }

        device::upsert_sync_state(conn, &device_id, &manifest.database_id, batch_version)?;
        self.save_manifest(&manifest).await?;

        Ok(batch_version)
    }

    pub async fn pull(&mut self, conn: &Connection) -> Result<i64, String> {
        if !self.drive.is_authenticated().await {
            return Err("não autenticado com Google".into());
        }

        let manifest = self.load_or_create_manifest(conn).await?;
        let device_id = device::get_or_create_device_id(conn)?;

        let local_version = device::get_local_sync_version(conn).unwrap_or(0);

        if manifest.latest_version <= local_version {
            return Ok(local_version);
        }

        let files = self
            .drive
            .list(&format!("{}/operations/", manifest.database_id))
            .await
            .map_err(|e| e.to_string())?;

        let mut applied_count = 0i64;
        let mut max_applied_version = local_version;

        for file in &files {
            if !file.name.starts_with("ops_") {
                continue;
            }

            let version_str = file
                .name
                .strip_prefix("ops_")
                .and_then(|s| s.split('.').next());
            let file_start_version: i64 = match version_str {
                Some(v) => v.parse().unwrap_or(0),
                None => continue,
            };

            if file_start_version > manifest.latest_version {
                continue;
            }

            let path = format!("{}/operations/{}", manifest.database_id, file.name);
            let data = self
                .drive
                .download(&path)
                .await
                .map_err(|e| e.to_string())?;

            let decrypted = self.decrypt_data(&data).map_err(|e| e.to_string())?;
            let decompressed = Self::decompress(&decrypted).map_err(|e| e.to_string())?;

            let remote_ops: RemoteOperations =
                serde_json::from_slice(&decompressed).map_err(|e| e.to_string())?;

            operations::set_sync_session(conn, true)?;

            for op in &remote_ops.operations {
                if op.version <= local_version {
                    continue;
                }

                let result = apply_operation(conn, op);
                match result {
                    Ok(()) => applied_count += 1,
                    Err(e) => {
                        log::warn!(
                            "sync: falha ao aplicar operação v{} {}: {}",
                            op.version,
                            op.entity,
                            e
                        );
                    }
                }

                if op.version > max_applied_version {
                    max_applied_version = op.version;
                }
            }

            operations::set_sync_session(conn, false)?;
        }

        if applied_count > 0 {
            regenerate_derived(conn)?;
        }

        let _now = chrono::Utc::now()
            .format("%Y-%m-%dT%H:%M:%SZ")
            .to_string();
        device::upsert_sync_state(
            conn,
            &device_id,
            &manifest.database_id,
            max_applied_version,
        )?;

        Ok(max_applied_version)
    }

    pub async fn full_sync(&mut self, conn: &Connection) -> Result<(i64, i64), String> {
        let pulled = self.pull(conn).await.unwrap_or(0);
        let pushed = self.push(conn).await.unwrap_or(0);
        Ok((pulled, pushed))
    }

    pub async fn first_sync_upload(
        &mut self,
        conn: &Connection,
    ) -> Result<(), String> {
        if !self.drive.is_authenticated().await {
            return Err("não autenticado com Google".into());
        }

        let mut manifest = self.load_or_create_manifest(conn).await?;
        let device_id = device::get_or_create_device_id(conn)?;

        let snapshot_data = payload::serialize_local_data(conn)?;
        let snapshot = RemoteSnapshot {
            database_id: manifest.database_id.clone(),
            created_at: chrono::Utc::now()
                .format("%Y-%m-%dT%H:%M:%SZ")
                .to_string(),
            version: 0,
            data: snapshot_data,
        };

        let json =
            serde_json::to_string(&snapshot).map_err(|e| e.to_string())?;
        let compressed = Self::compress(json.as_bytes())?;
        let encrypted = self.encrypt_data(&compressed)?;

        self.drive
            .upload(
                &Self::snapshot_path(&manifest.database_id),
                &encrypted,
                "application/json",
            )
            .await
            .map_err(|e| e.to_string())?;

        let now = chrono::Utc::now()
            .format("%Y-%m-%dT%H:%M:%SZ")
            .to_string();

        manifest.latest_version = 1;
        if let Some(d) = manifest.devices.iter_mut().find(|d| d.device_id == device_id) {
            d.last_sync_version = 1;
            d.last_sync_at = now.clone();
        } else {
            manifest.devices.push(DeviceMeta {
                device_id: device_id.clone(),
                device_name: device::get_device_name(),
                platform: device::get_platform(),
                last_sync_version: 0,
                last_sync_at: now.clone(),
            });
        }

        device::upsert_sync_state(conn, &device_id, &manifest.database_id, 1)?;
        self.save_manifest(&manifest).await?;

        Ok(())
    }

    pub async fn first_sync_download(
        &mut self,
        conn: &Connection,
    ) -> Result<u64, String> {
        if !self.drive.is_authenticated().await {
            return Err("não autenticado com Google".into());
        }

        let manifest = self.load_or_create_manifest(conn).await?;

        let data = self
            .drive
            .download(&Self::snapshot_path(&manifest.database_id))
            .await
            .map_err(|e| format!("snapshot não encontrado: {e}"))?;

        let decrypted = self.decrypt_data(&data).map_err(|e| e.to_string())?;
        let decompressed = Self::decompress(&decrypted).map_err(|e| e.to_string())?;

        let snapshot: RemoteSnapshot =
            serde_json::from_slice(&decompressed).map_err(|e| e.to_string())?;

        let mut count = 0u64;
        operations::set_sync_session(conn, true)?;
        apply_snapshot(conn, &snapshot.data, &mut count)?;
        operations::set_sync_session(conn, false)?;

        if count > 0 {
            regenerate_derived(conn)?;
        }

        let device_id = device::get_or_create_device_id(conn)?;
        let _now = chrono::Utc::now()
            .format("%Y-%m-%dT%H:%M:%SZ")
            .to_string();
        device::upsert_sync_state(conn, &device_id, &manifest.database_id, manifest.latest_version)?;

        Ok(count)
    }

    pub async fn status(&self, conn: &Connection) -> SyncStatus {
        if !self.drive.is_authenticated().await {
            return SyncStatus::Disconnected;
        }
        match device::get_local_sync_version(conn) {
            Ok(v) => {
                if v > 0 {
                    SyncStatus::Synced {
                        at: chrono::Local::now()
                            .format("%Y-%m-%d %H:%M")
                            .to_string(),
                    }
                } else {
                    SyncStatus::Offline
                }
            }
            Err(_) => SyncStatus::Offline,
        }
    }
}

fn apply_operation(conn: &Connection, op: &operations::SyncOperation) -> Result<(), String> {
    let uuid = &op.entity_uuid;
    let entity = &op.entity;
    let payload = &op.payload;
    let op_ts = &op.op_timestamp;

    match op.operation.as_str() {
        "INSERT" | "UPDATE" => {
            let should_apply = conflict::should_apply_remote(conn, entity, uuid, op_ts)?;
            if !should_apply {
                return Ok(());
            }
            apply_upsert(conn, entity, payload, op_ts)?;
        }
        "DELETE" => {
            apply_soft_delete(conn, entity, uuid, op_ts)?;
        }
        _ => {
            log::warn!("sync: operação desconhecida: {}", op.operation);
        }
    }
    Ok(())
}

fn resolve_account_id(
    conn: &Connection,
    payload: &serde_json::Value,
) -> Result<i64, String> {
    if let Some(u) = payload.get("account_uuid").and_then(|v| v.as_str()) {
        if !u.is_empty() {
            if let Some(id) = payload::resolve_local_id(conn, "accounts", u)? {
                return Ok(id);
            }
        }
    }
    conn.query_row(
        "SELECT id FROM accounts WHERE deleted_at IS NULL ORDER BY id LIMIT 1",
        [],
        |r| r.get(0),
    )
    .map_err(|e| e.to_string())
}

fn apply_upsert(
    conn: &Connection,
    entity: &str,
    payload: &serde_json::Value,
    op_ts: &str,
) -> Result<(), String> {
    let get_str = |key: &str| -> Option<String> {
        payload.get(key).and_then(|v| v.as_str()).map(String::from)
    };

    let uuid = get_str("uuid").unwrap_or_default();

    match entity {
        "accounts" => {
            let name = get_str("name").unwrap_or_default();
            let color = get_str("color").unwrap_or_else(|| "#5865f2".into());
            let created_at = get_str("created_at");
            let updated_at = get_str("updated_at").unwrap_or_else(|| op_ts.to_string());
            let deleted_at = get_str("deleted_at");

            let existing: Option<i64> = conn
                .query_row(
                    "SELECT id FROM accounts WHERE uuid = ?1",
                    rusqlite::params![uuid],
                    |r| r.get(0),
                )
                .ok();

            if let Some(id) = existing {
                conn.execute(
                    "UPDATE accounts SET name = ?1, color = ?2, updated_at = ?3, deleted_at = ?4
                     WHERE id = ?5",
                    rusqlite::params![name, color, updated_at, deleted_at, id],
                )
                .map_err(|e| e.to_string())?;
            } else {
                conn.execute(
                    "INSERT INTO accounts (uuid, name, color, created_at, updated_at, deleted_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![uuid, name, color, created_at, updated_at, deleted_at],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        "payment_methods" => {
            let name = get_str("name").unwrap_or_default();
            let type_: i64 = payload.get("type").and_then(|v| v.as_i64()).unwrap_or(1);
            let metadata = get_str("metadata");
            let created_at = get_str("created_at");
            let updated_at = get_str("updated_at").unwrap_or_else(|| op_ts.to_string());
            let deleted_at = get_str("deleted_at");

            let existing: Option<i64> = conn
                .query_row(
                    "SELECT id FROM payment_methods WHERE uuid = ?1",
                    rusqlite::params![uuid],
                    |r| r.get(0),
                )
                .ok();

            if let Some(id) = existing {
                conn.execute(
                    "UPDATE payment_methods SET name = ?1, type = ?2, metadata = ?3,
                     updated_at = ?4, deleted_at = ?5
                     WHERE id = ?6",
                    rusqlite::params![name, type_, metadata, updated_at, deleted_at, id],
                )
                .map_err(|e| e.to_string())?;
            } else {
                let account_id = resolve_account_id(conn, payload)?;
                conn.execute(
                    "INSERT INTO payment_methods (uuid, account_id, name, type, metadata, created_at, updated_at, deleted_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    rusqlite::params![uuid, account_id, name, type_, metadata, created_at, updated_at, deleted_at],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        "categories" => {
            let name = get_str("name").unwrap_or_default();
            let type_: i64 = payload.get("type").and_then(|v| v.as_i64()).unwrap_or(1);
            let color = get_str("color").unwrap_or_else(|| "#6b7280".into());
            let icon = get_str("icon");
            let created_at = get_str("created_at");
            let updated_at = get_str("updated_at").unwrap_or_else(|| op_ts.to_string());
            let deleted_at = get_str("deleted_at");

            let existing: Option<i64> = conn
                .query_row(
                    "SELECT id FROM categories WHERE uuid = ?1",
                    rusqlite::params![uuid],
                    |r| r.get(0),
                )
                .ok();

            if let Some(id) = existing {
                conn.execute(
                    "UPDATE categories SET name = ?1, type = ?2, color = ?3, icon = ?4,
                     updated_at = ?5, deleted_at = ?6
                     WHERE id = ?7",
                    rusqlite::params![name, type_, color, icon, updated_at, deleted_at, id],
                )
                .map_err(|e| e.to_string())?;
            } else {
                let account_id = resolve_account_id(conn, payload)?;
                conn.execute(
                    "INSERT INTO categories (uuid, account_id, name, type, color, icon, created_at, updated_at, deleted_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    rusqlite::params![uuid, account_id, name, type_, color, icon, created_at, updated_at, deleted_at],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        "fixed_bills" => {
            let description = get_str("description").unwrap_or_default();
            let amount: i64 = payload.get("amount").and_then(|v| v.as_i64()).unwrap_or(0);
            let day: i64 = payload.get("day").and_then(|v| v.as_i64()).unwrap_or(1);
            let category_uuid = get_str("category_uuid");
            let payment_method_uuid = get_str("payment_method_uuid");
            let start_month = get_str("start_month").unwrap_or_default();
            let end_month = get_str("end_month");
            let installments: Option<i64> = payload.get("installments").and_then(|v| v.as_i64());
            let purchase_date = get_str("purchase_date");
            let created_at = get_str("created_at");
            let updated_at = get_str("updated_at").unwrap_or_else(|| op_ts.to_string());
            let deleted_at = get_str("deleted_at");

            let category_id = category_uuid
                .as_deref()
                .and_then(|u| payload::resolve_local_id(conn, "categories", u).ok().flatten());
            let pm_id = payment_method_uuid
                .as_deref()
                .and_then(|u| payload::resolve_local_id(conn, "payment_methods", u).ok().flatten());

            let existing: Option<i64> = conn
                .query_row(
                    "SELECT id FROM fixed_bills WHERE uuid = ?1",
                    rusqlite::params![uuid],
                    |r| r.get(0),
                )
                .ok();

            if let Some(id) = existing {
                conn.execute(
                    "UPDATE fixed_bills SET description = ?1, amount = ?2, day = ?3,
                     category_id = ?4, payment_method_id = ?5, start_month = ?6,
                     end_month = ?7, installments = ?8, purchase_date = ?9,
                     updated_at = ?10, deleted_at = ?11
                     WHERE id = ?12",
                    rusqlite::params![
                        description, amount, day, category_id, pm_id, start_month,
                        end_month, installments, purchase_date, updated_at, deleted_at, id
                    ],
                )
                .map_err(|e| e.to_string())?;
            } else {
                let pm_id = pm_id.ok_or("payment_method_uuid não resolvido")?;
                let account_id = resolve_account_id(conn, payload)?;
                conn.execute(
                    "INSERT INTO fixed_bills (uuid, account_id, description, amount, day, category_id,
                     payment_method_id, start_month, end_month, installments, purchase_date,
                     created_at, updated_at, deleted_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                    rusqlite::params![
                        uuid, account_id, description, amount, day, category_id, pm_id, start_month,
                        end_month, installments, purchase_date, created_at, updated_at, deleted_at
                    ],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        "loans" => {
            let type_: i64 = payload.get("type").and_then(|v| v.as_i64()).unwrap_or(1);
            let description = get_str("description").unwrap_or_default();
            let principal: i64 = payload.get("principal").and_then(|v| v.as_i64()).unwrap_or(0);
            let installment: i64 = payload.get("installment").and_then(|v| v.as_i64()).unwrap_or(0);
            let total_installments: i64 = payload.get("total_installments").and_then(|v| v.as_i64()).unwrap_or(0);
            let day: i64 = payload.get("day").and_then(|v| v.as_i64()).unwrap_or(1);
            let start_month = get_str("start_month").unwrap_or_default();
            let payment_method_uuid = get_str("payment_method_uuid");
            let monthly_rate: f64 = payload.get("monthly_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let created_at = get_str("created_at");
            let updated_at = get_str("updated_at").unwrap_or_else(|| op_ts.to_string());
            let deleted_at = get_str("deleted_at");

            let pm_id = payment_method_uuid
                .as_deref()
                .and_then(|u| payload::resolve_local_id(conn, "payment_methods", u).ok().flatten());

            let existing: Option<i64> = conn
                .query_row(
                    "SELECT id FROM loans WHERE uuid = ?1",
                    rusqlite::params![uuid],
                    |r| r.get(0),
                )
                .ok();

            if let Some(id) = existing {
                conn.execute(
                    "UPDATE loans SET type = ?1, description = ?2, principal = ?3,
                     installment = ?4, total_installments = ?5, day = ?6,
                     start_month = ?7, payment_method_id = ?8, monthly_rate = ?9,
                     updated_at = ?10, deleted_at = ?11
                     WHERE id = ?12",
                    rusqlite::params![
                        type_, description, principal, installment, total_installments,
                        day, start_month, pm_id, monthly_rate, updated_at, deleted_at, id
                    ],
                )
                .map_err(|e| e.to_string())?;
            } else {
                let pm_id = pm_id.ok_or("payment_method_uuid não resolvido")?;
                let account_id = resolve_account_id(conn, payload)?;
                conn.execute(
                    "INSERT INTO loans (uuid, account_id, type, description, principal, installment,
                     total_installments, day, start_month, payment_method_id, monthly_rate,
                     created_at, updated_at, deleted_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                    rusqlite::params![
                        uuid, account_id, type_, description, principal, installment, total_installments,
                        day, start_month, pm_id, monthly_rate, created_at, updated_at, deleted_at
                    ],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        "transactions" => {
            let description = get_str("description").unwrap_or_default();
            let amount: i64 = payload.get("amount").and_then(|v| v.as_i64()).unwrap_or(0);
            let type_: i64 = payload.get("type").and_then(|v| v.as_i64()).unwrap_or(1);
            let date = get_str("date").unwrap_or_default();
            let category_uuid = get_str("category_uuid");
            let payment_method_uuid = get_str("payment_method_uuid");
            let fixed_bill_uuid = get_str("fixed_bill_uuid");
            let loan_uuid = get_str("loan_uuid");
            let bill_start = get_str("bill_start");
            let bill_end = get_str("bill_end");
            let card_mode: i64 = payload.get("card_mode").and_then(|v| v.as_i64()).unwrap_or(0);
            let created_at = get_str("created_at");
            let updated_at = get_str("updated_at").unwrap_or_else(|| op_ts.to_string());
            let deleted_at = get_str("deleted_at");

            let category_id = category_uuid
                .as_deref()
                .and_then(|u| payload::resolve_local_id(conn, "categories", u).ok().flatten());
            let pm_id = payment_method_uuid
                .as_deref()
                .and_then(|u| payload::resolve_local_id(conn, "payment_methods", u).ok().flatten());
            let fb_id = fixed_bill_uuid
                .as_deref()
                .and_then(|u| payload::resolve_local_id(conn, "fixed_bills", u).ok().flatten());
            let loan_id = loan_uuid
                .as_deref()
                .and_then(|u| payload::resolve_local_id(conn, "loans", u).ok().flatten());

            let existing: Option<i64> = conn
                .query_row(
                    "SELECT id FROM transactions WHERE uuid = ?1",
                    rusqlite::params![uuid],
                    |r| r.get(0),
                )
                .ok();

            if let Some(id) = existing {
                conn.execute(
                    "UPDATE transactions SET description = ?1, amount = ?2, type = ?3, date = ?4,
                     category_id = ?5, payment_method_id = ?6, fixed_bill_id = ?7, loan_id = ?8,
                     bill_start = ?9, bill_end = ?10, card_mode = ?11,
                     updated_at = ?12, deleted_at = ?13
                     WHERE id = ?14",
                    rusqlite::params![
                        description, amount, type_, date, category_id, pm_id, fb_id,
                        loan_id, bill_start, bill_end, card_mode, updated_at, deleted_at, id
                    ],
                )
                .map_err(|e| e.to_string())?;
            } else {
                let account_id = resolve_account_id(conn, payload)?;
                conn.execute(
                    "INSERT INTO transactions (uuid, account_id, description, amount, type, date,
                     category_id, payment_method_id, fixed_bill_id, loan_id,
                     bill_start, bill_end, card_mode, created_at, updated_at, deleted_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
                    rusqlite::params![
                        uuid, account_id, description, amount, type_, date, category_id, pm_id, fb_id,
                        loan_id, bill_start, bill_end, card_mode, created_at, updated_at, deleted_at
                    ],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        "settings" => {
            let key = get_str("key").unwrap_or_default();
            let value = get_str("value").unwrap_or_default();
            let created_at = get_str("created_at");
            let updated_at = get_str("updated_at").unwrap_or_else(|| op_ts.to_string());
            let deleted_at = get_str("deleted_at");
            let account_id = resolve_account_id(conn, payload)?;

            let existing = conn
                .query_row(
                    "SELECT 1 FROM settings WHERE key = ?1 AND account_id = ?2",
                    rusqlite::params![key, account_id],
                    |_| Ok(()),
                )
                .ok();

            if existing.is_some() {
                conn.execute(
                    "UPDATE settings SET value = ?1, updated_at = ?2, deleted_at = ?3
                     WHERE key = ?4 AND account_id = ?5",
                    rusqlite::params![value, updated_at, deleted_at, key, account_id],
                )
                .map_err(|e| e.to_string())?;
            } else {
                conn.execute(
                    "INSERT INTO settings (account_id, key, uuid, value, created_at, updated_at, deleted_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    rusqlite::params![account_id, key, get_str("uuid").unwrap_or_default(), value, created_at, updated_at, deleted_at],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        _ => {}
    }
    Ok(())
}

fn apply_soft_delete(
    conn: &Connection,
    entity: &str,
    entity_uuid: &str,
    op_ts: &str,
) -> Result<(), String> {
    let should = conflict::should_apply_remote(conn, entity, entity_uuid, op_ts)?;
    if !should {
        return Ok(());
    }

    // PK composto do settings: deleta só pela linha com o uuid exato.
    let sql = if entity == "settings" {
        "UPDATE settings SET deleted_at = ?1, updated_at = ?1
         WHERE uuid = ?2 AND uuid != '' AND deleted_at IS NULL"
    } else {
        "UPDATE {entity} SET deleted_at = ?1, updated_at = ?1 WHERE uuid = ?2 AND deleted_at IS NULL"
    };
    let sql = sql.replace("{entity}", entity);

    conn.execute(&sql, rusqlite::params![op_ts, entity_uuid])
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn apply_snapshot(
    conn: &Connection,
    data: &payload::SnapshotData,
    count: &mut u64,
) -> Result<(), String> {
    let now = chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%SZ")
        .to_string();

    for row in &data.accounts {
        apply_snapshot_row(conn, "accounts", row, &now)?;
        *count += 1;
    }
    for row in &data.payment_methods {
        apply_snapshot_row(conn, "payment_methods", row, &now)?;
        *count += 1;
    }
    for row in &data.categories {
        apply_snapshot_row(conn, "categories", row, &now)?;
        *count += 1;
    }
    for row in &data.fixed_bills {
        apply_snapshot_row(conn, "fixed_bills", row, &now)?;
        *count += 1;
    }
    for row in &data.loans {
        apply_snapshot_row(conn, "loans", row, &now)?;
        *count += 1;
    }
    for row in &data.transactions {
        apply_snapshot_row(conn, "transactions", row, &now)?;
        *count += 1;
    }
    for row in &data.settings {
        apply_snapshot_row(conn, "settings", row, &now)?;
        *count += 1;
    }

    Ok(())
}

fn apply_snapshot_row(
    conn: &Connection,
    entity: &str,
    row: &serde_json::Value,
    now: &str,
) -> Result<(), String> {
    let op = operations::SyncOperation {
        id: None,
        device_id: "snapshot".into(),
        entity: entity.into(),
        entity_uuid: row
            .get("uuid")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .into(),
        operation: "INSERT".into(),
        payload: row.clone(),
        op_timestamp: now.into(),
        version: 0,
        synced_at: None,
    };
    apply_operation(conn, &op)
}

fn regenerate_derived(conn: &Connection) -> Result<(), String> {
    let accounts: Vec<i64> = {
        let mut stmt = conn
            .prepare("SELECT id FROM accounts WHERE deleted_at IS NULL")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| r.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };

    for account_id in accounts {
        let min = conn
            .query_row(
                "SELECT MIN(date) FROM transactions WHERE account_id = ?1",
                rusqlite::params![account_id],
                |r| r.get::<_, Option<String>>(0),
            )
            .map_err(|e| e.to_string())?;

        if let Some(min_date) = min {
            if min_date.len() >= 7 {
                let start_month = &min_date[..7];
                let now = chrono::Local::now().date_naive();
                let mut m = crate::shared::util::parse_month(start_month)
                    .map_err(|e| e.to_string())?;

                while m <= now {
                    crate::organizacao_financeira::service::generate_fixed_bills(conn, account_id, m)
                        .map_err(|e| e.to_string())?;
                    crate::organizacao_financeira::service::generate_loan_installments(conn, account_id, m)
                        .map_err(|e| e.to_string())?;
                    m = m
                        .checked_add_months(chrono::Months::new(1))
                        .unwrap();
                }
            }
        }

        crate::shared::card_bills::refresh_card_bills(conn, account_id)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
