use chrono::{Datelike, Months, NaiveDate};

use crate::db::{with_db_active, AppState};
use tauri::{AppHandle, State};

pub fn parse_month(s: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(&format!("{s}-01"), "%Y-%m-%d")
        .map_err(|_| format!("mês inválido: {s}"))
}

pub fn month_range(month: &str) -> Result<(NaiveDate, NaiveDate), String> {
    let start = parse_month(month)?;
    let end = start.checked_add_months(Months::new(1)).unwrap();
    Ok((start, end))
}

/// Meses entre dois "YYYY-MM" (from <= to).
pub fn month_diff(from: &str, to: &str) -> i64 {
    let f = parse_month(from).unwrap();
    let t = parse_month(to).unwrap();
    (t.year() as i64) * 12 + t.month0() as i64 - ((f.year() as i64) * 12 + f.month0() as i64)
}

pub fn current_month() -> String {
    chrono::Local::now().date_naive().format("%Y-%m").to_string()
}

pub fn db_err(e: impl std::fmt::Display) -> String {
    format!("erro de banco de dados: {e}")
}

pub fn order_clause(
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
    whitelist: &[(&str, &str)],
    default: &str,
    tiebreak: &str,
) -> String {
    let Some(key) = sort_by else {
        return default.to_string();
    };
    let Some(expr) = whitelist.iter().find(|(k, _)| *k == key).map(|(_, e)| *e) else {
        return default.to_string();
    };
    let dir = match sort_dir.map(|d| d.to_ascii_lowercase()).as_deref() {
        Some("asc") => "ASC",
        Some("desc") => "DESC",
        _ => return default.to_string(),
    };
    format!("ORDER BY {expr} {dir}, {tiebreak}")
}

pub(crate) fn month_str_to_date(s: &str) -> Result<chrono::NaiveDate, String> {
    chrono::NaiveDate::parse_from_str(&format!("{s}-01"), "%Y-%m-%d")
        .map_err(|_| format!("mês inválido: {s}"))
}

pub fn add_months(s: &str, n: u32) -> String {
    let d = month_str_to_date(s).unwrap();
    d.checked_add_months(chrono::Months::new(n))
        .unwrap()
        .format("%Y-%m")
        .to_string()
}

#[tauri::command]
pub fn get_earliest_month(state: State<'_, AppState>) -> Result<String, String> {
    with_db_active(&state, |c, a| crate::shared::settings::earliest_month(c, a))
}

#[tauri::command]
pub fn get_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn order_clause_chave_valida() {
        let wl = &[("amount", "t.amount"), ("date", "t.date")];
        assert_eq!(
            order_clause(Some("amount"), Some("asc"), wl, "ORDER BY t.date DESC, t.id DESC", "t.id DESC"),
            "ORDER BY t.amount ASC, t.id DESC"
        );
        assert_eq!(
            order_clause(Some("amount"), Some("desc"), wl, "ORDER BY t.date DESC, t.id DESC", "t.id DESC"),
            "ORDER BY t.amount DESC, t.id DESC"
        );
        assert_eq!(
            order_clause(Some("amount"), Some("Asc"), wl, "ORDER BY t.date DESC, t.id DESC", "t.id DESC"),
            "ORDER BY t.amount ASC, t.id DESC"
        );
    }

    #[test]
    fn order_clause_fallback_padrao() {
        let wl = &[("amount", "t.amount")];
        assert_eq!(order_clause(None, None, wl, "ORDER BY t.date DESC", "t.id DESC"), "ORDER BY t.date DESC");
        assert_eq!(order_clause(Some("amount"), None, wl, "ORDER BY t.date DESC", "t.id DESC"), "ORDER BY t.date DESC");
        assert_eq!(order_clause(Some("unknown"), Some("asc"), wl, "ORDER BY t.date DESC", "t.id DESC"), "ORDER BY t.date DESC");
        assert_eq!(order_clause(Some("amount"), Some("bogus"), wl, "ORDER BY t.date DESC", "t.id DESC"), "ORDER BY t.date DESC");
    }
}
