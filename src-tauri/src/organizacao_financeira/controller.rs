use crate::db::{with_db, AppState};
use crate::organizacao_financeira::models::{
    CardBillDetail, Category, CategoryInput, FixedBill, FixedBillInput, Loan, LoanDetail, LoanInput,
    PaymentMethod, PaymentMethodInput, TransactionInput, TransactionRow,
};
use crate::organizacao_financeira::{repository, service};
use crate::shared::card_bills;
use crate::shared::util::current_month;
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

// ---- transactions ----

#[tauri::command]
pub async fn list_transactions(
    state: State<'_, AppState>,
    month: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<TransactionRow>, String> {
    with_db(&state, |c| repository::list_transactions(c, month.as_deref(), sort_by.as_deref(), sort_dir.as_deref()))
}

#[tauri::command]
pub async fn create_transaction(
    state: State<'_, AppState>,
    input: TransactionInput,
) -> Result<(), String> {
    input.validate()?;
    with_db(&state, |c| service::create(c, &input))
}

#[tauri::command]
pub async fn update_transaction(
    state: State<'_, AppState>,
    id: i64,
    input: TransactionInput,
) -> Result<(), String> {
    input.validate()?;
    with_db(&state, |c| service::update(c, id, &input))
}

#[tauri::command]
pub async fn delete_transactions(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| {
        service::delete_ids(c, &ids)?;
        card_bills::refresh_card_bills(c)
    })
}

#[tauri::command]
pub async fn get_card_bill(state: State<'_, AppState>, id: i64) -> Result<CardBillDetail, String> {
    with_db(&state, |c| {
        let (pm_id, pm_name, bill_start, bill_end, due, description) =
            repository::get_card_bill_query(c, id)?;
        let (Some(bs), Some(be)) = (bill_start, bill_end) else {
            return Err("transação não é uma fatura".into());
        };
        let txs = repository::card_bill_purchases(c, pm_id, &bs, &be)?;
        let total: i64 = txs.iter().map(|t| t.amount).sum();
        Ok(CardBillDetail {
            id,
            description,
            payment_method_name: pm_name,
            period_start: bs,
            period_end: be,
            due_date: due,
            total,
            transactions: txs,
        })
    })
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
        let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        let placeholders = vec!["?"; ids.len()].join(",");
        // Soft delete transactions linked to these fixed_bills
        c.execute(
            &format!(
                "UPDATE transactions SET deleted_at = ?1, updated_at = ?1
                 WHERE fixed_bill_id IN ({placeholders}) AND deleted_at IS NULL"
            ),
            rusqlite::params_from_iter(
                std::iter::once(Box::new(now.clone()) as Box<dyn rusqlite::types::ToSql>)
                    .chain(ids.iter().map(|id| Box::new(*id) as Box<dyn rusqlite::types::ToSql>)),
            ),
        )
        .map_err(crate::shared::util::db_err)?;
        // Soft delete the fixed_bills
        c.execute(
            &format!(
                "UPDATE fixed_bills SET deleted_at = ?1, updated_at = ?1
                 WHERE id IN ({placeholders}) AND deleted_at IS NULL"
            ),
            rusqlite::params_from_iter(
                std::iter::once(Box::new(now) as Box<dyn rusqlite::types::ToSql>)
                    .chain(ids.iter().map(|id| Box::new(*id) as Box<dyn rusqlite::types::ToSql>)),
            ),
        )
        .map_err(crate::shared::util::db_err)?;
        card_bills::refresh_card_bills(c)
    })
}

// ---- loans ----

#[tauri::command]
pub async fn list_loans(
    state: State<'_, AppState>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<Loan>, String> {
    with_db(&state, |c| repository::list_loans(c, sort_by.as_deref(), sort_dir.as_deref()))
}

#[tauri::command]
pub async fn get_loan_detail(state: State<'_, AppState>, id: i64) -> Result<LoanDetail, String> {
    with_db(&state, |c| {
        let loan = repository::get_loan_detail(c, id)?;
        let schedule = service::loan_schedule(
            loan.principal,
            loan.installment,
            loan.total_installments,
            &loan.start_month,
            loan.monthly_rate,
            &current_month(),
        );
        Ok(LoanDetail { loan, schedule })
    })
}

#[tauri::command]
pub async fn create_loan(state: State<'_, AppState>, input: LoanInput) -> Result<(), String> {
    input.validate()?;
    with_db(&state, |c| {
        let rate = if input.monthly_rate > 0.0 {
            input.monthly_rate
        } else {
            service::loan_monthly_rate(input.principal, input.installment, input.total_installments)
        };
        repository::create_loan(c, &input, rate)
    })
}

#[tauri::command]
pub async fn update_loan(
    state: State<'_, AppState>,
    id: i64,
    input: LoanInput,
) -> Result<(), String> {
    input.validate()?;
    with_db(&state, |c| {
        let rate = if input.monthly_rate > 0.0 {
            input.monthly_rate
        } else {
            service::loan_monthly_rate(input.principal, input.installment, input.total_installments)
        };
        let affected = c
            .execute(
                "UPDATE loans SET type = ?1, description = ?2, principal = ?3, installment = ?4,
                        total_installments = ?5, day = ?6, start_month = ?7, payment_method_id = ?8, monthly_rate = ?9
                 WHERE id = ?10",
                params![
                    input.type_,
                    input.description.trim(),
                    input.principal,
                    input.installment,
                    input.total_installments,
                    input.day,
                    input.start_month,
                    input.payment_method_id,
                    rate,
                    id
                ],
            )
            .map_err(crate::shared::util::db_err)?;
        if affected == 0 {
            return Err("empréstimo não encontrado".into());
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_loans(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| {
        let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        let placeholders = vec!["?"; ids.len()].join(",");
        // Soft delete transactions linked to these loans
        c.execute(
            &format!(
                "UPDATE transactions SET deleted_at = ?1, updated_at = ?1
                 WHERE loan_id IN ({placeholders}) AND deleted_at IS NULL"
            ),
            rusqlite::params_from_iter(
                std::iter::once(Box::new(now.clone()) as Box<dyn rusqlite::types::ToSql>)
                    .chain(ids.iter().map(|id| Box::new(*id) as Box<dyn rusqlite::types::ToSql>)),
            ),
        )
        .map_err(crate::shared::util::db_err)?;
        // Soft delete the loans
        c.execute(
            &format!(
                "UPDATE loans SET deleted_at = ?1, updated_at = ?1
                 WHERE id IN ({placeholders}) AND deleted_at IS NULL"
            ),
            rusqlite::params_from_iter(
                std::iter::once(Box::new(now) as Box<dyn rusqlite::types::ToSql>)
                    .chain(ids.iter().map(|id| Box::new(*id) as Box<dyn rusqlite::types::ToSql>)),
            ),
        )
        .map_err(crate::shared::util::db_err)?;
        card_bills::refresh_card_bills(c)
    })
}
