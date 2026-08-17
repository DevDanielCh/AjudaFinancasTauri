use crate::db::{with_db, AppState};
use crate::organizacao_financeira::models::{
    Category, CategoryInput, FixedBill, FixedBillInput, PaymentMethod, PaymentMethodInput,
};
use crate::organizacao_financeira::{repository, service};
use crate::shared::card_bills;
use rusqlite::params;
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

// ---- fixed_bills ----

#[tauri::command]
pub async fn list_fixed_bills(
    state: State<'_, AppState>,
    only_installments: bool,
    sort_by: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<FixedBill>, String> {
    with_db(&state, |c| repository::list_fixed_bills(c, only_installments, sort_by.as_deref(), sort_dir.as_deref()))
}

#[tauri::command]
pub async fn create_fixed_bill(
    state: State<'_, AppState>,
    mut input: FixedBillInput,
) -> Result<(), String> {
    with_db(&state, |c| service::create_fixed_bill(c, &mut input))
}

#[tauri::command]
pub async fn update_fixed_bill(
    state: State<'_, AppState>,
    id: i64,
    mut input: FixedBillInput,
) -> Result<(), String> {
    with_db(&state, |c| {
        service::finalize_installments(c, &mut input)?;
        input.validate()?;
        let affected = c
            .execute(
                "UPDATE fixed_bills SET description = ?1, amount = ?2, day = ?3, category_id = ?4,
                        payment_method_id = ?5, start_month = ?6, end_month = ?7, installments = ?8, purchase_date = ?9
                 WHERE id = ?10",
                params![
                    input.description.trim(),
                    input.amount,
                    input.day,
                    input.category_id,
                    input.payment_method_id,
                    input.start_month,
                    input.end_month,
                    input.installments,
                    input.purchase_date,
                    id
                ],
            )
            .map_err(crate::shared::util::db_err)?;
        if affected == 0 {
            return Err("conta fixa não encontrada".into());
        }
        c.execute(
            "DELETE FROM transactions WHERE fixed_bill_id = ?1",
            params![id],
        )
        .map_err(crate::shared::util::db_err)?;
        service::reconcile_fixed_bills(c, &input.start_month, chrono::Local::now().date_naive())?;
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_fixed_bills(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| {
        let placeholders = vec!["?"; ids.len()].join(",");
        c.execute(
            &format!("DELETE FROM transactions WHERE fixed_bill_id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(crate::shared::util::db_err)?;
        c.execute(
            &format!("DELETE FROM fixed_bills WHERE id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(crate::shared::util::db_err)?;
        card_bills::refresh_card_bills(c)
    })
}
