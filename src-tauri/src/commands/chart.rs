use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::ChartData;
use chrono::Months;
use tauri::State;

fn build(conn: &rusqlite::Connection, month: &str) -> Result<ChartData, String> {
    let ref_month = domain::parse_month(month)?;
    domain::generate_fixed_bills(conn, ref_month)?;
    domain::generate_loan_installments(conn, ref_month)?;
    domain::refresh_card_bills(conn)?;
    let next = ref_month.checked_add_months(Months::new(1)).unwrap();
    Ok(ChartData {
        monthly: domain::monthly_series(conn, ref_month)?,
        expenses_by_cat: domain::expenses_by_category(conn, ref_month, next)?,
        expenses_by_pm: domain::expenses_by_pm(conn, ref_month)?,
    })
}

#[tauri::command]
pub async fn get_chart_data(state: State<'_, AppState>, month: String) -> Result<ChartData, String> {
    let now = chrono::Local::now().date_naive();
    with_db(&state, |c| {
        domain::sync_generated(c, now)?;
        build(c, &month)
    })
}
