use std::sync::atomic::Ordering;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::State;
use tauri_plugin_opener::OpenerExt;

use crate::db::{with_db, AppState};
use crate::google::auth::PendingAuth;
use crate::google::credential;
use crate::sync::device;
use crate::sync::engine::SyncEngine;
use crate::sync::provider::DriveProvider;

pub struct SyncState {
    pub client_id: String,
    pub client_secret: String,
    pub pending_auth: Mutex<Option<PendingAuth>>,
    pub syncing: std::sync::atomic::AtomicBool,
}

#[tauri::command]
pub async fn sync_start_auth(
    sync_state: State<'_, SyncState>,
) -> Result<String, String> {
    let client_id = sync_state.client_id.clone();
    let client_secret = sync_state.client_secret.clone();
    let (url, pending) = crate::google::auth::start_auth(&client_id, &client_secret)
        .await
        .map_err(|e| e.to_string())?;

    *sync_state.pending_auth.lock().map_err(|e| e.to_string())? = Some(pending);

    Ok(url)
}

#[tauri::command]
pub async fn sync_complete_auth(
    state: State<'_, AppState>,
    sync_state: State<'_, SyncState>,
) -> Result<String, String> {
    let pending = sync_state
        .pending_auth
        .lock()
        .map_err(|e| e.to_string())?
        .take()
        .ok_or("nenhuma autenticação em andamento")?;

    let client_id = sync_state.client_id.clone();
    let client_secret = sync_state.client_secret.clone();
    crate::google::auth::complete_auth(&client_id, &client_secret, pending)
        .await
        .map_err(|e| e.to_string())?;

    with_db(&state, |conn| {
        device::get_or_create_device_id(conn)
    })?;

    Ok("Conta Google conectada com sucesso".into())
}

#[tauri::command]
pub async fn sync_open_url(handle: AppHandle, url: String) -> Result<(), String> {
    handle.opener().open_url(&url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sync_connect_google(
    state: State<'_, AppState>,
    sync_state: State<'_, SyncState>,
) -> Result<String, String> {
    let client_id = sync_state.client_id.clone();
    let client_secret = sync_state.client_secret.clone();
    let mut drive = crate::google::drive::GoogleDriveProvider::new(client_id.clone(), client_secret);
    drive.authenticate().await.map_err(|e| e.to_string())?;

    with_db(&state, |conn| {
        device::get_or_create_device_id(conn)
    })?;

    Ok("Conta Google conectada com sucesso".into())
}

#[tauri::command]
pub async fn sync_disconnect(
    _state: State<'_, AppState>,
) -> Result<(), String> {
    credential::clear_credentials().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sync_status(
    state: State<'_, AppState>,
    sync_state: State<'_, SyncState>,
) -> Result<String, String> {
    if credential::load_refresh_token().is_none() {
        return Ok("disconnected".into());
    }

    if sync_state.syncing.load(Ordering::Relaxed) {
        return Ok("syncing".into());
    }

    let local_version = {
        let guard = state.db.lock().unwrap_or_else(|p| p.into_inner());
        device::get_local_sync_version(&guard).unwrap_or(0)
    };

    Ok(if local_version > 0 {
        "synced".into()
    } else {
        "offline".into()
    })
}

#[tauri::command]
pub async fn sync_now(
    state: State<'_, AppState>,
    sync_state: State<'_, SyncState>,
) -> Result<String, String> {
    sync_state.syncing.store(true, Ordering::Relaxed);

    let rt = tokio::runtime::Handle::current();
    let client_id = sync_state.client_id.clone();
    let client_secret = sync_state.client_secret.clone();
    let passphrase = credential::load_passphrase();
    let mut drive = crate::google::drive::GoogleDriveProvider::new(client_id.clone(), client_secret);
    drive.authenticate().await.map_err(|e| {
        sync_state.syncing.store(false, Ordering::Relaxed);
        e.to_string()
    })?;

    let mut engine = SyncEngine::new(drive, client_id, passphrase);

    let result = with_db(&state, |conn| {
        let (pulled, pushed) = tokio::task::block_in_place(|| rt.block_on(engine.full_sync(conn)))?;
        Ok(format!("Sincronizado: {pulled} recebido(s), {pushed} enviado(s)"))
    });

    sync_state.syncing.store(false, Ordering::Relaxed);
    result
}

#[tauri::command]
pub async fn sync_first_upload(
    state: State<'_, AppState>,
    sync_state: State<'_, SyncState>,
) -> Result<String, String> {
    sync_state.syncing.store(true, Ordering::Relaxed);

    let rt = tokio::runtime::Handle::current();
    let client_id = sync_state.client_id.clone();
    let client_secret = sync_state.client_secret.clone();
    let passphrase = credential::load_passphrase();
    let mut drive = crate::google::drive::GoogleDriveProvider::new(client_id.clone(), client_secret);
    drive.authenticate().await.map_err(|e| {
        sync_state.syncing.store(false, Ordering::Relaxed);
        e.to_string()
    })?;

    let mut engine = SyncEngine::new(drive, client_id, passphrase);

    let result = with_db(&state, |conn| {
        tokio::task::block_in_place(|| rt.block_on(engine.first_sync_upload(conn)))?;
        Ok("Dados enviados para o Google Drive".into())
    });

    sync_state.syncing.store(false, Ordering::Relaxed);
    result
}

#[tauri::command]
pub async fn sync_first_download(
    state: State<'_, AppState>,
    sync_state: State<'_, SyncState>,
) -> Result<String, String> {
    sync_state.syncing.store(true, Ordering::Relaxed);

    let rt = tokio::runtime::Handle::current();
    let client_id = sync_state.client_id.clone();
    let client_secret = sync_state.client_secret.clone();
    let passphrase = credential::load_passphrase();
    let mut drive = crate::google::drive::GoogleDriveProvider::new(client_id.clone(), client_secret);
    drive.authenticate().await.map_err(|e| {
        sync_state.syncing.store(false, Ordering::Relaxed);
        e.to_string()
    })?;

    let mut engine = SyncEngine::new(drive, client_id, passphrase);

    let result = with_db(&state, |conn| {
        let count = tokio::task::block_in_place(|| rt.block_on(engine.first_sync_download(conn)))?;
        Ok(format!("Dados recebidos: {count} registros"))
    });

    sync_state.syncing.store(false, Ordering::Relaxed);
    result
}

#[tauri::command]
pub async fn sync_is_connected() -> Result<bool, String> {
    Ok(credential::load_refresh_token().is_some())
}

#[tauri::command]
pub async fn sync_set_passphrase(passphrase: String) -> Result<(), String> {
    credential::store_passphrase(&passphrase).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sync_auto(
    state: State<'_, AppState>,
    sync_state: State<'_, SyncState>,
) -> Result<String, String> {
    sync_state.syncing.store(true, Ordering::Relaxed);

    let client_id = sync_state.client_id.clone();
    let client_secret = sync_state.client_secret.clone();
    let passphrase = credential::load_passphrase();
    let mut drive = crate::google::drive::GoogleDriveProvider::new(client_id.clone(), client_secret);
    drive.authenticate().await.map_err(|e| {
        sync_state.syncing.store(false, Ordering::Relaxed);
        e.to_string()
    })?;

    let mut engine = SyncEngine::new(drive, client_id, passphrase);

    let rt = tokio::runtime::Handle::current();

    let (db_path, local_version) = {
        let guard = state.db.lock().unwrap_or_else(|p| p.into_inner());
        (
            crate::sync::device::get_database_id(&guard).unwrap_or_default(),
            crate::sync::device::get_local_sync_version(&guard).unwrap_or(0),
        )
    };

    let has_remote = engine
        .drive
        .exists(&format!("{db_path}/snapshots/snapshot.json.gz"))
        .await
        .unwrap_or(false);

    let result = with_db(&state, |conn| {
        if !has_remote || local_version == 0 {
            if local_version > 0 {
                tokio::task::block_in_place(|| rt.block_on(engine.first_sync_upload(conn)))?;
                Ok("Dados enviados para o Google Drive".into())
            } else {
                match tokio::task::block_in_place(|| rt.block_on(engine.first_sync_download(conn))) {
                    Ok(count) => Ok(format!("Dados recebidos: {count} registros")),
                    Err(_) => {
                        tokio::task::block_in_place(|| rt.block_on(engine.first_sync_upload(conn)))?;
                        Ok("Primeira sincronização realizada".into())
                    }
                }
            }
        } else {
            let (pulled, pushed) = tokio::task::block_in_place(|| rt.block_on(engine.full_sync(conn)))?;
            Ok(format!("Sincronizado: {pulled} recebido(s), {pushed} enviado(s)"))
        }
    });

    sync_state.syncing.store(false, Ordering::Relaxed);
    result
}
