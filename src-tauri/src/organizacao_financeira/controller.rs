use crate::db::{with_db, AppState};
use crate::organizacao_financeira::models::{
    Category, CategoryInput, PaymentMethod, PaymentMethodInput,
};
use crate::organizacao_financeira::{repository, service};
use tauri::State;

#[tauri::command]
pub async fn list_categories(
    state: State<'_, AppState>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<Category>, String> {
    with_db(&state, |c| repository::list_categories(c, sort_by.as_deref(), sort_dir.as_deref()))
}

#[tauri::command]
pub async fn create_category(state: State<'_, AppState>, input: CategoryInput) -> Result<(), String> {
    service::validate_category(&input)?;
    with_db(&state, |c| service::create_category(c, &input))
}

#[tauri::command]
pub async fn update_category(
    state: State<'_, AppState>,
    id: i64,
    input: CategoryInput,
) -> Result<(), String> {
    service::validate_category(&input)?;
    with_db(&state, |c| service::update_category(c, id, &input))
}

#[tauri::command]
pub async fn delete_categories(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| service::delete_categories(c, &ids))
}

#[tauri::command]
pub async fn list_payment_methods(
    state: State<'_, AppState>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<PaymentMethod>, String> {
    with_db(&state, |c| repository::list_payment_methods(c, sort_by.as_deref(), sort_dir.as_deref()))
}

#[tauri::command]
pub async fn create_payment_method(
    state: State<'_, AppState>,
    input: PaymentMethodInput,
) -> Result<(), String> {
    service::validate_payment_method(&input)?;
    with_db(&state, |c| service::create_payment_method(c, &input))
}

#[tauri::command]
pub async fn update_payment_method(
    state: State<'_, AppState>,
    id: i64,
    input: PaymentMethodInput,
) -> Result<(), String> {
    service::validate_payment_method(&input)?;
    with_db(&state, |c| service::update_payment_method(c, id, &input))
}

#[tauri::command]
pub async fn delete_payment_methods(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| service::delete_payment_methods(c, &ids))
}
