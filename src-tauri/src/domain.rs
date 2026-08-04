use chrono::{Datelike, Months, NaiveDate};
use rusqlite::Connection;

pub fn parse_month(s: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(&format!("{s}-01"), "%Y-%m-%d")
        .map_err(|_| format!("mês inválido: {s}"))
}

pub fn month_range(month: &str) -> Result<(NaiveDate, NaiveDate), String> {
    let start = parse_month(month)?;
    let end = start.checked_add_months(Months::new(1)).unwrap();
    Ok((start, end))
}

pub fn last_day_of(d: NaiveDate) -> u32 {
    d.with_day(1)
        .unwrap()
        .checked_add_months(Months::new(1))
        .unwrap()
        .pred_opt()
        .unwrap()
        .day()
}

/// Período de fatura do cartão: fechamento do mês anterior até fechamento do mês de referência.
pub fn billing_period(close_day: u32, ref_month: NaiveDate) -> (NaiveDate, NaiveDate) {
    let prev = ref_month.checked_sub_months(Months::new(1)).unwrap();
    let start_day = close_day.min(last_day_of(prev));
    let end_day = close_day.min(last_day_of(ref_month));
    (
        prev.with_day(start_day).unwrap(),
        ref_month.with_day(end_day).unwrap(),
    )
}

pub fn current_month() -> String {
    chrono::Local::now().date_naive().format("%Y-%m").to_string()
}

/// Mês (YYYY-MM) da transação mais antiga, ou mês corrente.
pub fn earliest_month(conn: &Connection) -> Result<String, String> {
    let min = conn.query_row("SELECT MIN(date) FROM transactions", [], |r| {
        r.get::<_, Option<String>>(0)
    });
    match min {
        Ok(Some(d)) if d.len() >= 7 => Ok(d[..7].to_string()),
        _ => Ok(current_month()),
    }
}

pub fn db_err(e: impl std::fmt::Display) -> String {
    format!("erro de banco de dados: {e}")
}

pub fn month_income(conn: &Connection, start: NaiveDate, end: NaiveDate) -> Result<i64, String> {
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE type = 1 AND date >= ?1 AND date < ?2",
            rusqlite::params![start.format("%Y-%m-%d").to_string(), end.format("%Y-%m-%d").to_string()],
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
             WHERE type = 2 AND payment_method_id = ?1 AND date >= ?2 AND date < ?3",
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

pub fn no_pm_expenses(conn: &Connection, start: NaiveDate, end: NaiveDate) -> Result<i64, String> {
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE type = 2 AND payment_method_id IS NULL AND date >= ?1 AND date < ?2",
            rusqlite::params![start.format("%Y-%m-%d").to_string(), end.format("%Y-%m-%d").to_string()],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(v)
}

fn card_close_day(ty: i64, meta: Option<&str>) -> Option<i64> {
    if ty != 2 {
        return None;
    }
    meta.and_then(|m| serde_json::from_str::<serde_json::Value>(m).ok())
        .and_then(|v| v.get("close_day")?.as_i64())
}

/// Despesas do mês de referência respeitando billing period de cartões.
pub fn month_expenses(conn: &Connection, ref_month: NaiveDate) -> Result<i64, String> {
    let (start, end) = (
        ref_month.with_day(1).unwrap(),
        ref_month.checked_add_months(Months::new(1)).unwrap(),
    );
    let mut total = 0;
    let mut stmt = conn
        .prepare("SELECT id, type, metadata FROM payment_methods")
        .map_err(db_err)?;
    let pms = stmt
        .query_map([], |r| {
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
    total += no_pm_expenses(conn, start, end)?;
    Ok(total)
}

pub fn income_by_category(
    conn: &Connection,
    start: NaiveDate,
    end: NaiveDate,
) -> Result<Vec<crate::models::BreakdownRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT COALESCE(c.name, 'Sem categoria') AS name, SUM(t.amount) AS total
             FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
             WHERE t.type = 1 AND t.date >= ?1 AND t.date < ?2
             GROUP BY c.name ORDER BY total DESC",
        )
        .map_err(db_err)?;
    let rows = stmt
        .query_map(
            rusqlite::params![start.format("%Y-%m-%d").to_string(), end.format("%Y-%m-%d").to_string()],
            |r| {
                Ok(crate::models::BreakdownRow {
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

pub fn expenses_by_pm(
    conn: &Connection,
    ref_month: NaiveDate,
) -> Result<Vec<crate::models::BreakdownRow>, String> {
    let (start, end) = (
        ref_month.with_day(1).unwrap(),
        ref_month.checked_add_months(Months::new(1)).unwrap(),
    );
    let mut out = Vec::new();
    let mut stmt = conn
        .prepare("SELECT id, name, type, metadata FROM payment_methods ORDER BY name")
        .map_err(db_err)?;
    let pms = stmt
        .query_map([], |r| {
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
        let mut s = start;
        let mut e = end;
        if let Some(cd) = card_close_day(ty, meta.as_deref()) {
            if cd > 0 {
                let (ps, pe) = billing_period(cd as u32, ref_month);
                s = ps;
                e = pe;
            }
        }
        let t = pm_expenses(conn, id, s, e)?;
        if t > 0 {
            out.push(crate::models::BreakdownRow { name, total: t });
        }
    }
    let no_pm = no_pm_expenses(conn, start, end)?;
    if no_pm > 0 {
        out.push(crate::models::BreakdownRow {
            name: "Sem forma de pagamento".into(),
            total: no_pm,
        });
    }
    out.sort_by(|a, b| b.total.cmp(&a.total));
    Ok(out)
}

/// Gera transações das contas fixas ativas no mês. Dia clampado ao último dia.
pub fn generate_fixed_bills(conn: &Connection, month: NaiveDate) -> Result<(), String> {
    let month_key = month.format("%Y-%m").to_string();
    let mut stmt = conn
        .prepare(
            "SELECT id, description, amount, day, category_id, payment_method_id
             FROM fixed_bills
             WHERE start_month <= ?1 AND (end_month IS NULL OR end_month >= ?1)",
        )
        .map_err(db_err)?;
    let bills = stmt
        .query_map(rusqlite::params![month_key], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, Option<i64>>(4)?,
                r.get::<_, i64>(5)?,
            ))
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;

    let start = month.with_day(1).unwrap().format("%Y-%m-%d").to_string();
    let end = month
        .checked_add_months(Months::new(1))
        .unwrap()
        .format("%Y-%m-%d")
        .to_string();
    let last = last_day_of(month) as i64;

    for (id, description, amount, day, category_id, payment_method_id) in bills {
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE fixed_bill_id = ?1 AND date >= ?2 AND date < ?3",
                rusqlite::params![id, start, end],
                |r| r.get(0),
            )
            .map_err(db_err)?;
        if exists > 0 {
            continue;
        }
        let due = month
            .with_day(day.min(last) as u32)
            .unwrap()
            .format("%Y-%m-%d")
            .to_string();
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, category_id, payment_method_id, fixed_bill_id, loan_id)
             VALUES (?1, ?2, 2, ?3, ?4, ?5, ?6, NULL)",
            rusqlite::params![description, amount, due, category_id, payment_method_id, id],
        )
        .map_err(db_err)?;
    }
    Ok(())
}

/// Gera entrada (empréstimos) e parcelas mensais dos empréstimos ativos no mês.
pub fn generate_loan_installments(conn: &Connection, month: NaiveDate) -> Result<(), String> {
    let month_key = month.format("%Y-%m").to_string();
    let start = month.with_day(1).unwrap().format("%Y-%m-%d").to_string();
    let end = month
        .checked_add_months(Months::new(1))
        .unwrap()
        .format("%Y-%m-%d")
        .to_string();

    let mut stmt = conn
        .prepare(
            "SELECT id, type, description, principal, installment, total_installments, day, payment_method_id, start_month
             FROM loans",
        )
        .map_err(db_err)?;
    let loans = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, i64>(5)?,
                r.get::<_, i64>(6)?,
                r.get::<_, i64>(7)?,
                r.get::<_, String>(8)?,
            ))
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;

    for (id, ty, description, principal, installment, total_n, day, pm_id, start_month) in loans {
        if start_month > month_key {
            continue;
        }
        let loan_start = parse_month(&start_month).map_err(db_err)?;
        let loan_end = loan_start
            .checked_add_months(Months::new(total_n as u32 - 1))
            .unwrap();
        if loan_end < month {
            continue;
        }

        if ty == 1 {
            let exists: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM transactions WHERE loan_id = ?1 AND type = 1",
                    rusqlite::params![id],
                    |r| r.get(0),
                )
                .map_err(db_err)?;
            if exists == 0 {
                conn.execute(
                    "INSERT INTO transactions (description, amount, type, date, payment_method_id, loan_id)
                     VALUES (?1, ?2, 1, ?3, ?4, ?5)",
                    rusqlite::params![
                        format!("{description} (entrada)"),
                        principal,
                        loan_start.format("%Y-%m-%d").to_string(),
                        pm_id,
                        id
                    ],
                )
                .map_err(db_err)?;
            }
        }

        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE loan_id = ?1 AND type = 2 AND date >= ?2 AND date < ?3",
                rusqlite::params![id, start, end],
                |r| r.get(0),
            )
            .map_err(db_err)?;
        if exists == 0 {
            let due_day = day.min(last_day_of(month) as i64) as u32;
            let due = month.with_day(due_day).unwrap().format("%Y-%m-%d").to_string();
            conn.execute(
                "INSERT INTO transactions (description, amount, type, date, payment_method_id, loan_id)
                 VALUES (?1, ?2, 2, ?3, ?4, ?5)",
                rusqlite::params![description, installment, due, pm_id, id],
            )
            .map_err(db_err)?;
        }
    }
    Ok(())
}

/// Regera contas fixas e parcelas de todos os meses com movimento, do mais antigo ao atual.
pub fn sync_generated(conn: &Connection, now: NaiveDate) -> Result<(), String> {
    let min = conn.query_row("SELECT MIN(date) FROM transactions", [], |r| {
        r.get::<_, Option<String>>(0)
    });
    let Some(min) = min.ok().flatten() else {
        return Ok(());
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
                "SELECT COUNT(*) FROM transactions WHERE date >= ?1 AND date < ?2",
                rusqlite::params![start, end],
                |r| r.get(0),
            )
            .map_err(db_err)?;
        if count > 0 {
            generate_fixed_bills(conn, m)?;
            generate_loan_installments(conn, m)?;
        }
        m = m.checked_add_months(Months::new(1)).unwrap();
    }
    Ok(())
}
