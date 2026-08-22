use crate::db::{with_db_active, AppState};
use crate::investimentos::repository;
use tauri::State;

#[tauri::command]
pub async fn list_reserva_movements(
    state: State<'_, AppState>,
) -> Result<Vec<crate::organizacao_financeira::models::TransactionRow>, String> {
    with_db_active(&state, |c, a| repository::list_reserva_movements_impl(c, a))
}
