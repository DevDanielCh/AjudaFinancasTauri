use chrono::{Datelike, Months, NaiveDate};
use rusqlite::Connection;
use serde::Serialize;

use crate::db::{with_db_active, AppState};
use crate::shared::card_bills::{
    billing_period, card_close_day, card_days, card_debit_expenses, ensure_card_bills,
    refresh_card_bills,
};
use crate::shared::settings;
use crate::shared::util::{db_err, parse_month};
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct BreakdownRow {
    pub name: String,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DashboardData {
    pub month: String,
    pub income: i64,
    pub expenses: i64,
    pub balance: i64,
    pub prev_balance: i64,
    pub income_by_cat: Vec<BreakdownRow>,
    pub expenses_by_pm: Vec<BreakdownRow>,
    /// Percentual configurado das receitas destinado a investimentos (0–100).
    pub meta_investimento: f64,
    /// Aportes à reserva (type 4) no mês.
    pub aportes: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct MonthlyPoint {
    pub month: String,
    pub income: i64,
    pub expenses: i64,
    pub balance: i64,
    /// Saldo da reserva/investimentos no fim do mês (histórico completo).
    pub reserva: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChartData {
    pub monthly: Vec<MonthlyPoint>,
    pub expenses_by_cat: Vec<BreakdownRow>,
    pub expenses_by_pm: Vec<BreakdownRow>,
}

pub fn month_income(conn: &Connection, account_id: i64, start: NaiveDate, end: NaiveDate) -> Result<i64, String> {
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE type IN (1, 5) AND date >= ?1 AND date < ?2 AND deleted_at IS NULL AND account_id = ?3",
            rusqlite::params![start.format("%Y-%m-%d").to_string(), end.format("%Y-%m-%d").to_string(), account_id],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(v)
}

pub fn pm_expenses(
    conn: &Connection,
    pm_id: i64,
    start: NaiveDate,
    end: NaiveDate,
) -> Result<i64, String> {
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE type IN (2, 4) AND payment_method_id = ?1 AND date >= ?2 AND date < ?3
               AND deleted_at IS NULL",
            rusqlite::params![
                pm_id,
                start.format("%Y-%m-%d").to_string(),
                end.format("%Y-%m-%d").to_string()
            ],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(v)
}

pub fn no_pm_expenses(conn: &Connection, account_id: i64, start: NaiveDate, end: NaiveDate) -> Result<i64, String> {
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE type IN (2, 4) AND payment_method_id IS NULL AND date >= ?1 AND date < ?2
               AND deleted_at IS NULL AND account_id = ?3",
            rusqlite::params![start.format("%Y-%m-%d").to_string(), end.format("%Y-%m-%d").to_string(), account_id],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(v)
}


/// Despesas do mês de referência. Cartões com fatura configurada (fechamento +
/// vencimento) não contam as compras a crédito; a transação Fatura conta no mês
/// do vencimento e compras a débito contam no mês civil da compra.
pub fn month_expenses(conn: &Connection, account_id: i64, ref_month: NaiveDate) -> Result<i64, String> {
    let (start, end) = (
        ref_month.with_day(1).unwrap(),
        ref_month.checked_add_months(Months::new(1)).unwrap(),
    );
    let mut total = 0;
    let mut stmt = conn
        .prepare("SELECT id, type, metadata FROM payment_methods WHERE account_id = ?1")
        .map_err(db_err)?;
    let pms = stmt
        .query_map(rusqlite::params![account_id], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, Option<String>>(2)?,
            ))
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    for (id, ty, meta) in pms {
        if card_days(ty, meta.as_deref()).is_some() {
            // Fatura substitui o crédito; débito é despesa normal no mês civil.
            total += card_debit_expenses(conn, id, start, end)?;
            continue;
        }
        let mut s = start;
        let mut e = end;
        if let Some(cd) = card_close_day(ty, meta.as_deref()) {
            if cd > 0 {
                let (ps, pe) = billing_period(cd as u32, ref_month);
                s = ps;
                e = pe;
            }
        }
        total += pm_expenses(conn, id, s, e)?;
    }
    total += no_pm_expenses(conn, account_id, start, end)?;
    let bills: i64 = conn
        .query_row(
             "SELECT COALESCE(SUM(amount), 0) FROM transactions
              WHERE type = 3 AND date >= ?1 AND date < ?2 AND deleted_at IS NULL AND account_id = ?3",
            rusqlite::params![start.format("%Y-%m-%d").to_string(), end.format("%Y-%m-%d").to_string(), account_id],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(total + bills)
}

pub fn income_by_category(
    conn: &Connection,
    account_id: i64,
    start: NaiveDate,
    end: NaiveDate,
) -> Result<Vec<BreakdownRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT COALESCE(c.name, 'Sem categoria') AS name, SUM(t.amount) AS total
             FROM transactions t LEFT JOIN categories c ON c.id = t.category_id AND c.deleted_at IS NULL
             WHERE t.type IN (1, 5) AND t.date >= ?1 AND t.date < ?2 AND t.deleted_at IS NULL AND t.account_id = ?3
             GROUP BY c.name ORDER BY total DESC",
        )
        .map_err(db_err)?;
    let rows = stmt
        .query_map(
            rusqlite::params![start.format("%Y-%m-%d").to_string(), end.format("%Y-%m-%d").to_string(), account_id],
            |r| {
                Ok(BreakdownRow {
                    name: r.get(0)?,
                    total: r.get(1)?,
                })
            },
        )
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(rows)
}

/// Despesas por categoria no período (type = 2; faturas type = 3 ficam de fora).
pub fn expenses_by_category(
    conn: &Connection,
    account_id: i64,
    start: NaiveDate,
    end: NaiveDate,
) -> Result<Vec<BreakdownRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT COALESCE(c.name, 'Sem categoria') AS name, SUM(t.amount) AS total
             FROM transactions t LEFT JOIN categories c ON c.id = t.category_id AND c.deleted_at IS NULL
             WHERE t.type IN (2, 4) AND t.date >= ?1 AND t.date < ?2 AND t.deleted_at IS NULL AND t.account_id = ?3
             GROUP BY c.name ORDER BY total DESC",
        )
        .map_err(db_err)?;
    let rows = stmt
        .query_map(
            rusqlite::params![
                start.format("%Y-%m-%d").to_string(),
                end.format("%Y-%m-%d").to_string(),
                account_id
            ],
            |r| {
                Ok(BreakdownRow {
                    name: r.get(0)?,
                    total: r.get(1)?,
                })
            },
        )
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(rows)
}

/// Posição da conta em `before` (data exclusiva): saldo inicial + fluxos
/// (receitas - despesas) dos meses desde o piso (ou a primeira transação).
pub fn account_balance_at(conn: &Connection, account_id: i64, before: NaiveDate) -> Result<i64, String> {
    let s = settings::get_settings_impl(conn, account_id)?;
    let start = match &s.primeiro_mes {
        Some(pm) => parse_month(pm)?,
        None => parse_month(&settings::earliest_tx_month(conn, account_id)?)?,
    };
    let mut bal = s.saldo_inicial_conta;
    let mut m = start;
    while m < before {
        let next = m.checked_add_months(Months::new(1)).unwrap();
        bal += month_income(conn, account_id, m, next)? - month_expenses(conn, account_id, m)?;
        m = next;
    }
    Ok(bal)
}

/// Série com todos os meses do ano de `ref_month`. Com saldo inicial
/// configurado, cada ponto usa a posição real da conta; sem config, o saldo
/// acumula desde zero no início do ano.
pub fn monthly_series(
    conn: &Connection,
    account_id: i64,
    ref_month: NaiveDate,
) -> Result<Vec<MonthlyPoint>, String> {
    let s = settings::get_settings_impl(conn, account_id)?;
    let with_piso = s.primeiro_mes.is_some();
    let start = ref_month.with_month(1).unwrap();
    let end = ref_month.with_month(12).unwrap();
    let mut out = Vec::with_capacity(12);
    let mut acc = 0;
    let mut m = start;
    while m <= end {
        let next = m.checked_add_months(Months::new(1)).unwrap();
        let income = month_income(conn, account_id, m, next)?;
        let expenses = month_expenses(conn, account_id, m)?;
        acc += income - expenses;
        out.push(MonthlyPoint {
            month: m.format("%Y-%m").to_string(),
            income,
            expenses,
            balance: if with_piso {
                account_balance_at(conn, account_id, next)?
            } else {
                acc
            },
            reserva: crate::investimentos::repository::reserva_balance_at(conn, account_id, next)?,
        });
        m = next;
    }
    Ok(out)
}

pub fn expenses_by_pm(
    conn: &Connection,
    account_id: i64,
    ref_month: NaiveDate,
) -> Result<Vec<BreakdownRow>, String> {
    let (start, end) = (
        ref_month.with_day(1).unwrap(),
        ref_month.checked_add_months(Months::new(1)).unwrap(),
    );
    let mut out = Vec::new();
    let mut stmt = conn
        .prepare("SELECT id, name, type, metadata FROM payment_methods WHERE account_id = ?1 ORDER BY name")
        .map_err(db_err)?;
    let pms = stmt
        .query_map(rusqlite::params![account_id], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, Option<String>>(3)?,
            ))
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    for (id, name, ty, meta) in pms {
        let t = if card_days(ty, meta.as_deref()).is_some() {
            let bill: i64 = conn
                .query_row(
                     "SELECT COALESCE(SUM(amount), 0) FROM transactions
                      WHERE type = 3 AND payment_method_id = ?1
                        AND date >= ?2 AND date < ?3 AND deleted_at IS NULL",
                    rusqlite::params![
                        id,
                        start.format("%Y-%m-%d").to_string(),
                        end.format("%Y-%m-%d").to_string()
                    ],
                    |r| r.get(0),
                )
                .map_err(db_err)?;
            let debit: i64 = card_debit_expenses(conn, id, start, end)?;
            bill + debit
        } else {
            let mut s = start;
            let mut e = end;
            if let Some(cd) = card_close_day(ty, meta.as_deref()) {
                if cd > 0 {
                    let (ps, pe) = billing_period(cd as u32, ref_month);
                    s = ps;
                    e = pe;
                }
            }
            pm_expenses(conn, id, s, e)?
        };
        if t > 0 {
            out.push(BreakdownRow { name, total: t });
        }
    }
    let no_pm = no_pm_expenses(conn, account_id, start, end)?;
    if no_pm > 0 {
        out.push(BreakdownRow {
            name: "Sem forma de pagamento".into(),
            total: no_pm,
        });
    }
    out.sort_by(|a, b| b.total.cmp(&a.total));
    Ok(out)
}

/// Regera contas fixas e parcelas de todos os meses com movimento, do mais antigo ao atual.
pub fn sync_generated(conn: &Connection, now: NaiveDate) -> Result<(), String> {
    let accounts: Vec<i64> = {
        let mut stmt = conn
            .prepare("SELECT id FROM accounts WHERE deleted_at IS NULL")
            .map_err(db_err)?;
        let rows = stmt
            .query_map([], |r| r.get(0))
            .map_err(db_err)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_err)?;
        rows
    };
    for account_id in accounts {
        let min = conn.query_row(
            "SELECT MIN(date) FROM transactions WHERE deleted_at IS NULL AND account_id = ?1",
            rusqlite::params![account_id],
            |r| r.get::<_, Option<String>>(0),
        );
        let Some(min) = min.ok().flatten() else {
            continue;
        };
        let mut m = parse_month(&min[..7]).map_err(db_err)?;
        while m <= now {
            let start = m.with_day(1).unwrap().format("%Y-%m-%d").to_string();
            let end = m
                .checked_add_months(Months::new(1))
                .unwrap()
                .format("%Y-%m-%d")
                .to_string();
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM transactions WHERE date >= ?1 AND date < ?2 AND deleted_at IS NULL AND account_id = ?3",
                    rusqlite::params![start, end, account_id],
                    |r| r.get(0),
                )
                .map_err(db_err)?;
            if count > 0 {
                crate::organizacao_financeira::service::generate_fixed_bills(conn, account_id, m)?;
                crate::organizacao_financeira::service::generate_loan_installments(conn, account_id, m)?;
            }
            m = m.checked_add_months(Months::new(1)).unwrap();
        }
    }
    Ok(())
}

fn build(conn: &rusqlite::Connection, account_id: i64, month: &str) -> Result<DashboardData, String> {
    let ref_month = parse_month(month)?;
    let prev = ref_month.checked_sub_months(Months::new(1)).unwrap();

    crate::organizacao_financeira::service::generate_fixed_bills(conn, account_id, ref_month)?;
    crate::organizacao_financeira::service::generate_loan_installments(conn, account_id, ref_month)?;
    refresh_card_bills(conn, account_id)?;
    ensure_card_bills(conn, account_id, prev)?;
    ensure_card_bills(conn, account_id, ref_month)?;

    let income = month_income(conn, account_id, ref_month, ref_month.checked_add_months(Months::new(1)).unwrap())?;
    let expenses = month_expenses(conn, account_id, ref_month)?;
    let prev_income = month_income(conn, account_id, prev, ref_month)?;
    let prev_expenses = month_expenses(conn, account_id, prev)?;

    let income_by_cat = income_by_category(
        conn,
        account_id,
        ref_month,
        ref_month.checked_add_months(Months::new(1)).unwrap(),
    )?;
    let expenses_by_pm = expenses_by_pm(conn, account_id, ref_month)?;

    let next = ref_month.checked_add_months(Months::new(1)).unwrap();
    let settings = settings::get_settings_impl(conn, account_id)?;
    let aportes = crate::investimentos::service::month_investments(conn, account_id, ref_month, next)?;
    let (balance, prev_balance) = if settings.primeiro_mes.is_some() {
        (
            account_balance_at(conn, account_id, next)?,
            account_balance_at(conn, account_id, ref_month)?,
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
    with_db_active(&state, |c, a| build(c, a, &month))
}

#[tauri::command]
pub async fn sync_dashboard(state: State<'_, AppState>, month: String) -> Result<DashboardData, String> {
    let now = chrono::Local::now().date_naive();
    with_db_active(&state, |c, a| {
        sync_generated(c, now)?;
        build(c, a, &month)
    })
}

fn build_chart(conn: &rusqlite::Connection, account_id: i64, month: &str) -> Result<ChartData, String> {
    let ref_month = parse_month(month)?;
    crate::organizacao_financeira::service::generate_fixed_bills(conn, account_id, ref_month)?;
    crate::organizacao_financeira::service::generate_loan_installments(conn, account_id, ref_month)?;
    refresh_card_bills(conn, account_id)?;
    let next = ref_month.checked_add_months(Months::new(1)).unwrap();
    Ok(ChartData {
        monthly: monthly_series(conn, account_id, ref_month)?,
        expenses_by_cat: expenses_by_category(conn, account_id, ref_month, next)?,
        expenses_by_pm: expenses_by_pm(conn, account_id, ref_month)?,
    })
}

#[tauri::command]
pub async fn get_chart_data(state: State<'_, AppState>, month: String) -> Result<ChartData, String> {
    let now = chrono::Local::now().date_naive();
    with_db_active(&state, |c, a| {
        sync_generated(c, now)?;
        build_chart(c, a, &month)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::{add_pm, add_tx, test_db};
    use rusqlite::params;

    #[test]
    fn month_expenses_counts_bill_not_card_purchases() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        let pix = add_pm(&conn, "PIX", 1, None);
        add_tx(&conn, "compra", 5000, "2026-05-15", Some(card));
        add_tx(&conn, "compra", 3000, "2026-06-05", Some(card));
        add_tx(&conn, "conta", 1500, "2026-06-10", Some(pix));
        crate::shared::card_bills::ensure_card_bills(&conn, 1, NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()).unwrap();

        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        assert_eq!(month_expenses(&conn, 1, jun).unwrap(), 9500);
        let mai = NaiveDate::from_ymd_opt(2026, 5, 1).unwrap();
        assert_eq!(month_expenses(&conn, 1, mai).unwrap(), 0);
    }

    #[test]
    fn month_expenses_conta_debito_do_cartao() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        add_tx(&conn, "credito", 5000, "2026-06-05", Some(card));
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, card_mode)
             VALUES ('debito', 3000, 2, '2026-06-15', ?1, 1)",
            params![card],
        )
        .unwrap();
        crate::shared::card_bills::ensure_card_bills(&conn, 1, NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()).unwrap();

        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        assert_eq!(month_expenses(&conn, 1, jun).unwrap(), 8000);
    }

    #[test]
    fn expenses_by_pm_conta_debito_do_cartao() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        add_tx(&conn, "credito", 5000, "2026-05-15", Some(card));
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, card_mode)
             VALUES ('debito', 3000, 2, '2026-06-15', ?1, 1)",
            params![card],
        )
        .unwrap();
        crate::shared::card_bills::ensure_card_bills(&conn, 1, NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()).unwrap();

        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        let rows = expenses_by_pm(&conn, 1, jun).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "Nubank");
        assert_eq!(rows[0].total, 8000);
    }

    #[test]
    fn reserva_conta_no_caixa_como_despesa_e_receita() {
        let conn = test_db();
        conn.execute_batch(
            "INSERT INTO transactions (description, amount, type, date) VALUES
             ('aporte', 100000, 4, '2026-06-10'),
             ('resgate', 30000, 5, '2026-06-15')",
        )
        .unwrap();
        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        let nxt = NaiveDate::from_ymd_opt(2026, 7, 1).unwrap();
        assert_eq!(month_income(&conn, 1, jun, nxt).unwrap(), 30000, "remoção conta como receita");
        assert_eq!(month_expenses(&conn, 1, jun).unwrap(), 100000, "adição conta como despesa");
    }

    #[test]
    fn monthly_series_inclui_saldo_da_reserva() {
        let conn = test_db();
        conn.execute_batch(
            "INSERT INTO transactions (description, amount, type, date) VALUES
             ('aporte', 50000, 4, '2026-06-10')",
        )
        .unwrap();
        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        let points = monthly_series(&conn, 1, jun).unwrap();
        let jun_pt = points.iter().find(|p| p.month == "2026-06").unwrap();
        assert_eq!(jun_pt.month, "2026-06");
        assert_eq!(jun_pt.reserva, 50000);
    }
}
