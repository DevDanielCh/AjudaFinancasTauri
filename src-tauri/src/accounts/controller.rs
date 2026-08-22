use tauri::State;

use super::models::{AccountInput, AccountInfo};
use super::service;
use crate::db::{with_db, AppState};

#[tauri::command]
pub async fn list_accounts(state: State<'_, AppState>) -> Result<Vec<AccountInfo>, String> {
    with_db(&state, |c| service::list(c))
}

#[tauri::command]
pub async fn get_active_account(state: State<'_, AppState>) -> Result<AccountInfo, String> {
    with_db(&state, |c| service::get_active(c))
}

/// Cria conta e já a torna ativa.
#[tauri::command]
pub async fn create_account(
    state: State<'_, AppState>,
    input: AccountInput,
) -> Result<AccountInfo, String> {
    let info = with_db(&state, |c| service::create(c, &input))?;
    state.set_active(info.id);
    Ok(info)
}

#[tauri::command]
pub async fn update_account(
    state: State<'_, AppState>,
    uuid: String,
    input: AccountInput,
) -> Result<(), String> {
    with_db(&state, |c| service::update(c, &uuid, &input))
}

/// Exclui a conta e todos os dados dela. Última conta é protegida.
#[tauri::command]
pub async fn delete_account(
    state: State<'_, AppState>,
    uuid: String,
) -> Result<AccountInfo, String> {
    let info = with_db(&state, |c| service::delete(c, &uuid))?;
    state.set_active(info.id);
    Ok(info)
}

#[tauri::command]
pub async fn set_active_account(
    state: State<'_, AppState>,
    uuid: String,
) -> Result<AccountInfo, String> {
    let info = with_db(&state, |c| service::switch(c, &uuid))?;
    state.set_active(info.id);
    Ok(info)
}
