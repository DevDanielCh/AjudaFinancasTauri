use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::DashboardData;
use crate::shared::card_bills;
use chrono::Months;
use tauri::State;

fn build(conn: &rusqlite::Connection, month: &str) -> Result<DashboardData, String> {
    let ref_month = domain::parse_month(month)?;
    let prev = ref_month.checked_sub_months(Months::new(1)).unwrap();

    domain::generate_fixed_bills(conn, ref_month)?;
    domain::generate_loan_installments(conn, ref_month)?;
    card_bills::refresh_card_bills(conn)?;
    card_bills::ensure_card_bills(conn, prev)?;
    card_bills::ensure_card_bills(conn, ref_month)?;

    let income = domain::month_income(conn, ref_month, ref_month.checked_add_months(Months::new(1)).unwrap())?;
    let expenses = domain::month_expenses(conn, ref_month)?;
    let prev_income = domain::month_income(conn, prev, ref_month)?;
    let prev_expenses = domain::month_expenses(conn, prev)?;

    let income_by_cat = domain::income_by_category(
        conn,
        ref_month,
        ref_month.checked_add_months(Months::new(1)).unwrap(),
    )?;
    let expenses_by_pm = domain::expenses_by_pm(conn, ref_month)?;

    let next = ref_month.checked_add_months(Months::new(1)).unwrap();
    let settings = crate::shared::settings::get_settings_impl(conn)?;
    let aportes = domain::month_investments(conn, ref_month, next)?;
    let (balance, prev_balance) = if settings.primeiro_mes.is_some() {
        (
            domain::account_balance_at(conn, next)?,
            domain::account_balance_at(conn, ref_month)?,
        )
    } else {
        (
            (prev_income - prev_expenses) + (income - expenses),
            prev_income - prev_expenses,
        )
    };

    Ok(DashboardData {
        month: month.to_string(),
        income,
        expenses,
        balance,
        prev_balance,
        income_by_cat,
        expenses_by_pm,
        meta_investimento: settings.meta_investimento,
        aportes,
    })
}

#[tauri::command]
pub async fn get_dashboard(state: State<'_, AppState>, month: String) -> Result<DashboardData, String> {
    with_db(&state, |c| build(c, &month))
}

#[tauri::command]
pub async fn sync_dashboard(state: State<'_, AppState>, month: String) -> Result<DashboardData, String> {
    let now = chrono::Local::now().date_naive();
    with_db(&state, |c| {
        domain::sync_generated(c, now)?;
        build(c, &month)
    })
}
