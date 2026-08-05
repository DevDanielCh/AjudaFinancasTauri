use chrono::{Datelike, Months, NaiveDate};
use rusqlite::{params, Connection};

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

/// Número da parcela (1-based) dado o mês inicial e o mês da parcela.
pub fn installment_index(start_month: &str, parcel_month: &str) -> i64 {
    month_diff(start_month, parcel_month).max(0) + 1
}

/// (mês YYYY-MM, dia) do parcelamento a partir da data da compra.
pub fn purchase_installment(purchase: &str) -> Result<(String, i64), String> {
    let d = NaiveDate::parse_from_str(purchase, "%Y-%m-%d")
        .map_err(|_| "data da compra inválida".to_string())?;
    Ok((d.format("%Y-%m").to_string(), d.day() as i64))
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

/// (fechamento, vencimento) do cartão, ambos > 0, ou None.
fn card_days(ty: i64, meta: Option<&str>) -> Option<(u32, u32)> {
    if ty != 2 {
        return None;
    }
    let v: serde_json::Value = serde_json::from_str(meta?).ok()?;
    let close = v.get("close_day")?.as_i64()?;
    let validity = v.get("validity_day")?.as_i64()?;
    if close <= 0 || validity <= 0 {
        return None;
    }
    Some((close as u32, validity as u32))
}

fn list_cards(conn: &Connection) -> Result<Vec<(i64, String, u32, u32)>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, type, metadata FROM payment_methods")
        .map_err(db_err)?;
    let rows = stmt
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
    Ok(rows
        .into_iter()
        .filter_map(|(id, name, ty, meta)| {
            card_days(ty, meta.as_deref()).map(|(c, v)| (id, name, c, v))
        })
        .collect())
}

pub fn fatura_capable_card_ids(conn: &Connection) -> Result<Vec<i64>, String> {
    Ok(list_cards(conn)?.into_iter().map(|(id, _, _, _)| id).collect())
}

/// True se a transação é uma fatura de cartão (type 3, gerada automaticamente).
pub fn is_card_bill(conn: &Connection, id: i64) -> Result<bool, String> {
    let n: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM transactions WHERE id = ?1 AND type = 3",
            params![id],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(n > 0)
}

/// Mês de fechamento da fatura paga em `payment_month`: mesmo mês se o vencimento
/// vem depois do fechamento, mês anterior caso contrário.
fn fatura_close_month(close_day: u32, validity_day: u32, payment_month: NaiveDate) -> NaiveDate {
    if validity_day > close_day {
        payment_month
    } else {
        payment_month.checked_sub_months(Months::new(1)).unwrap()
    }
}

/// Dados da fatura de um cartão paga em `payment_month`: (início, fim do período,
/// data de vencimento, total). None se o cartão não tem gastos no período.
fn card_bill(
    conn: &Connection,
    pm_id: i64,
    close_day: u32,
    validity_day: u32,
    payment_month: NaiveDate,
) -> Result<Option<(NaiveDate, NaiveDate, String, i64)>, String> {
    let close_m = fatura_close_month(close_day, validity_day, payment_month);
    let (start, end) = billing_period(close_day, close_m);
    let amount: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE type = 2 AND payment_method_id = ?1 AND bill_start IS NULL
               AND date >= ?2 AND date < ?3",
            rusqlite::params![
                pm_id,
                start.format("%Y-%m-%d").to_string(),
                end.format("%Y-%m-%d").to_string()
            ],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    if amount == 0 {
        return Ok(None);
    }
    let due_day = validity_day.min(last_day_of(payment_month));
    let due = payment_month
        .with_day(due_day)
        .unwrap()
        .format("%Y-%m-%d")
        .to_string();
    Ok(Some((start, end, due, amount)))
}

/// Gera as transações "Fatura - {nome}" dos cartões com vencimento em `payment_month`.
/// Não sobrescreve fatura já gerada (dedup por pm_id + bill_start).
pub fn ensure_card_bills(conn: &Connection, payment_month: NaiveDate) -> Result<(), String> {
    for (id, name, close, validity) in list_cards(conn)? {
        let Some((start, end, due, amount)) = card_bill(conn, id, close, validity, payment_month)?
        else {
            continue;
        };
        let start_s = start.format("%Y-%m-%d").to_string();
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE payment_method_id = ?1 AND bill_start = ?2",
                rusqlite::params![id, start_s],
                |r| r.get(0),
            )
            .map_err(db_err)?;
        if exists == 0 {
            conn.execute(
                "INSERT INTO transactions (description, amount, type, date, payment_method_id, bill_start, bill_end)
                 VALUES (?1, ?2, 3, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    format!("Fatura - {name}"),
                    amount,
                    due,
                    id,
                    start_s,
                    end.format("%Y-%m-%d").to_string()
                ],
            )
            .map_err(db_err)?;
        }
    }
    Ok(())
}

/// Recalcula todas as faturas dos meses com movimento até o mês corrente.
pub fn refresh_card_bills(conn: &Connection) -> Result<(), String> {
    conn.execute("DELETE FROM transactions WHERE bill_start IS NOT NULL", [])
        .map_err(db_err)?;
    let now = chrono::Local::now().date_naive();
    let mut m = parse_month(&earliest_month(conn)?).map_err(db_err)?;
    while m <= now {
        ensure_card_bills(conn, m)?;
        m = m.checked_add_months(Months::new(1)).unwrap();
    }
    Ok(())
}

/// Despesas do mês de referência. Cartões com fatura configurada (fechamento +
/// vencimento) não contam as compras; a transação Fatura conta no mês do vencimento.
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
        if card_days(ty, meta.as_deref()).is_some() {
            continue; // fatura substitui as compras
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
    total += no_pm_expenses(conn, start, end)?;
    let bills: i64 = conn
        .query_row(
             "SELECT COALESCE(SUM(amount), 0) FROM transactions
              WHERE type = 3 AND date >= ?1 AND date < ?2",
            rusqlite::params![start.format("%Y-%m-%d").to_string(), end.format("%Y-%m-%d").to_string()],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(total + bills)
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
        let t = if card_days(ty, meta.as_deref()).is_some() {
            conn.query_row(
                 "SELECT COALESCE(SUM(amount), 0) FROM transactions
                  WHERE type = 3 AND payment_method_id = ?1
                    AND date >= ?2 AND date < ?3",
                rusqlite::params![
                    id,
                    start.format("%Y-%m-%d").to_string(),
                    end.format("%Y-%m-%d").to_string()
                ],
                |r| r.get(0),
            )
            .map_err(db_err)?
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

use crate::models::AmortizationRow;

/// Taxa mensal i que resolve PV = PMT * (1-(1+i)^-n)/i por bisseção.
pub fn loan_monthly_rate(principal: i64, installment: i64, n: i64) -> f64 {
    if principal <= 0 || installment <= 0 || n < 1 {
        return 0.0;
    }
    let pv = principal as f64;
    let pmt = installment as f64;
    let n = n as f64;
    if pmt * n <= pv {
        return 0.0;
    }
    let g = |i: f64| pmt * (1.0 - (1.0 + i).powf(-n)) / i - pv;
    let mut lo = 0.0;
    let mut hi = 0.0001;
    while g(hi) > 0.0 && hi < 100.0 {
        hi *= 2.0;
    }
    for _ in 0..200 {
        let mid = (lo + hi) / 2.0;
        if g(mid) > 0.0 {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    (lo + hi) / 2.0
}

/// Tabela de amortização (parcelas iguais, juros sobre saldo devedor).
pub fn loan_schedule(principal: i64, installment: i64, n: i64, start_month: &str) -> Vec<AmortizationRow> {
    let rate = loan_monthly_rate(principal, installment, n);
    let mut balance = principal;
    let mut rows = Vec::with_capacity(n as usize);
    for k in 1..=n {
        let interest = (balance as f64 * rate).round() as i64;
        let mut p = installment - interest;
        let mut paid = installment;
        if k == n {
            p = balance;
            paid = interest + p;
        }
        balance -= p;
        let month = parse_month(start_month)
            .unwrap()
            .checked_add_months(Months::new(k as u32 - 1))
            .unwrap()
            .format("%Y-%m")
            .to_string();
        rows.push(AmortizationRow {
            number: k,
            month,
            installment: paid,
            interest,
            principal: p,
            balance,
        });
    }
    rows
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::{params, Connection};

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../migrations/001_init.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../migrations/002_card_bills.sql"))
            .unwrap();
        conn
    }

    fn add_pm(conn: &Connection, name: &str, ty: i64, meta: Option<&str>) -> i64 {
        conn.execute(
            "INSERT INTO payment_methods (name, type, metadata) VALUES (?1, ?2, ?3)",
            params![name, ty, meta],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    fn add_tx(conn: &Connection, desc: &str, amount: i64, date: &str, pm_id: Option<i64>) {
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id)
             VALUES (?1, ?2, 2, ?3, ?4)",
            params![desc, amount, date, pm_id],
        )
        .unwrap();
    }

    #[test]
    fn purchase_installment_uses_purchase_month_and_day() {
        assert_eq!(
            purchase_installment("2025-11-20").unwrap(),
            ("2025-11".to_string(), 20)
        );
        assert_eq!(
            purchase_installment("2025-01-05").unwrap(),
            ("2025-01".to_string(), 5)
        );
    }

    #[test]
    fn purchase_installment_rejects_invalid_date() {
        assert!(purchase_installment("20/11/2025").is_err());
        assert!(purchase_installment("garbage").is_err());
    }

    #[test]
    fn card_installment_lands_in_correct_fatura() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, category_id, payment_method_id, start_month, end_month, installments)
             VALUES ('Celular', 5000, 20, NULL, ?1, '2026-05', '2026-10', 6)",
            params![card],
        )
        .unwrap();
        generate_fixed_bills(&conn, NaiveDate::from_ymd_opt(2026, 5, 1).unwrap()).unwrap();
        ensure_card_bills(&conn, NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()).unwrap();

        let total: i64 = conn
            .query_row(
                "SELECT amount FROM transactions WHERE description = 'Fatura - Nubank' AND date = '2026-06-20'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(total, 5000);
    }

    #[test]
    fn fatura_close_month_follows_validity() {
        let jun = NaiveDate::from_ymd_opt(2026, 6, 15).unwrap();
        assert_eq!(fatura_close_month(10, 20, jun), jun);
        let prev = NaiveDate::from_ymd_opt(2026, 5, 15).unwrap();
        assert_eq!(fatura_close_month(25, 5, jun), prev);
    }

    #[test]
    fn installment_index_counts_from_start() {
        assert_eq!(installment_index("2026-05", "2026-05"), 1);
        assert_eq!(installment_index("2026-05", "2026-06"), 2);
        assert_eq!(installment_index("2026-05", "2026-07"), 3);
        assert_eq!(installment_index("2025-11", "2026-07"), 9);
        assert_eq!(installment_index("2026-07", "2026-05"), 1);
    }

    #[test]
    fn ensures_card_bill_period_and_due() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        add_tx(&conn, "compra 1", 5000, "2026-05-15", Some(card));
        add_tx(&conn, "compra 2", 3000, "2026-06-05", Some(card));
        add_tx(&conn, "fora do período", 2000, "2026-06-15", Some(card));

        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        ensure_card_bills(&conn, jun).unwrap();
        ensure_card_bills(&conn, jun).unwrap();

        let (amount, date, bs, be, ty): (i64, String, String, String, i64) = conn
            .query_row(
                "SELECT amount, date, bill_start, bill_end, type FROM transactions
                 WHERE description = 'Fatura - Nubank'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
            )
            .unwrap();
        assert_eq!(amount, 8000);
        assert_eq!(date, "2026-06-20");
        assert_eq!(bs, "2026-05-10");
        assert_eq!(be, "2026-06-10");
        assert_eq!(ty, 3);

        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE description = 'Fatura - Nubank'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 1);
    }

    #[test]
    fn due_in_next_month_when_validity_before_close() {
        let conn = test_db();
        let card = add_pm(&conn, "Cred", 2, Some(r#"{"close_day":25,"validity_day":5}"#));
        add_tx(&conn, "compra", 4000, "2026-04-20", Some(card));
        ensure_card_bills(&conn, NaiveDate::from_ymd_opt(2026, 5, 1).unwrap()).unwrap();
        let (amount, date): (i64, String) = conn
            .query_row(
                "SELECT amount, date FROM transactions WHERE description = 'Fatura - Cred'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(amount, 4000);
        assert_eq!(date, "2026-05-05");
    }

    #[test]
    fn month_expenses_counts_bill_not_card_purchases() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        let pix = add_pm(&conn, "PIX", 1, None);
        add_tx(&conn, "compra", 5000, "2026-05-15", Some(card));
        add_tx(&conn, "compra", 3000, "2026-06-05", Some(card));
        add_tx(&conn, "conta", 1500, "2026-06-10", Some(pix));
        ensure_card_bills(&conn, NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()).unwrap();

        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        assert_eq!(month_expenses(&conn, jun).unwrap(), 9500);
        let mai = NaiveDate::from_ymd_opt(2026, 5, 1).unwrap();
        assert_eq!(month_expenses(&conn, mai).unwrap(), 0);
    }

    #[test]
    fn card_without_validity_keeps_billing_period() {
        let conn = test_db();
        let card = add_pm(&conn, "Legado", 2, Some(r#"{"close_day":10}"#));
        add_tx(&conn, "compra", 7000, "2026-05-15", Some(card));
        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        assert_eq!(month_expenses(&conn, jun).unwrap(), 7000);
    }
}
