use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::{Settings, SettingsInput};
use tauri::State;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    with_db(&state, domain::get_settings)
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    input: SettingsInput,
) -> Result<(), String> {
    input.validate()?;
    with_db(&state, |c| domain::set_settings(c, &input))
}
