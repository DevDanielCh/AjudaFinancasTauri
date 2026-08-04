use crate::db::{with_db, AppState};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn get_earliest_month(state: State<'_, AppState>) -> Result<String, String> {
    with_db(&state, crate::domain::earliest_month)
}

#[tauri::command]
pub fn get_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}
