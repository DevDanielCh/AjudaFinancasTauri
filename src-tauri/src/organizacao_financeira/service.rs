use chrono::{Datelike, Months, NaiveDate};
use crate::organizacao_financeira::models::{AmortizationRow, CategoryInput, FixedBillInput, PaymentMethodInput, TransactionInput};
use crate::shared::card_bills::{self, last_day_of, refresh_card_bills};
use crate::shared::settings;
use crate::shared::util::{db_err, month_diff, parse_month};
use rusqlite::{params, Connection, OptionalExtension};

pub fn create_category(conn: &Connection, account_id: i64, input: &CategoryInput) -> Result<(), String> {
    let name = input.name.trim();
    let dup = conn
        .query_row(
            "SELECT 1 FROM categories WHERE name = ?1 AND account_id = ?2 LIMIT 1",
            params![name, account_id],
            |_| Ok(()),
        )
        .optional()
        .map_err(db_err)?;
    if dup.is_some() {
        return Err("já existe categoria com esse nome".into());
    }
    conn.execute(
        "INSERT INTO categories (account_id, name, type, color, icon) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![account_id, name, input.type_, input.color, input.icon],
    )
    .map_err(db_err)?;
    Ok(())
}

pub(crate) fn validate_category(input: &CategoryInput) -> Result<(), String> {
    if input.name.trim().is_empty() {
        return Err("nome é obrigatório".into());
    }
    if input.type_ != 1 && input.type_ != 2 {
        return Err("tipo inválido".into());
    }
    Ok(())
}

pub(crate) fn update_category(conn: &Connection, account_id: i64, id: i64, input: &CategoryInput) -> Result<(), String> {
    let affected = conn
        .execute(
            "UPDATE categories SET name = ?1, type = ?2, color = ?3, icon = ?4 WHERE id = ?5 AND account_id = ?6",
            params![input.name.trim(), input.type_, input.color, input.icon, id, account_id],
        )
        .map_err(db_err)?;
    if affected == 0 {
        return Err("categoria não encontrada".into());
    }
    Ok(())
}

pub(crate) fn delete_categories(conn: &Connection, ids: &[i64]) -> Result<(), String> {
    let placeholders = vec!["?"; ids.len()].join(",");
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    conn.execute(
        &format!(
            "UPDATE categories SET deleted_at = ?1, updated_at = ?1 WHERE id IN ({placeholders}) AND deleted_at IS NULL"
        ),
        rusqlite::params_from_iter(
            std::iter::once(Box::new(now.clone()) as Box<dyn rusqlite::types::ToSql>)
                .chain(ids.iter().map(|id| Box::new(*id) as Box<dyn rusqlite::types::ToSql>)),
        ),
    )
    .map_err(db_err)?;
    Ok(())
}

pub fn create_payment_method(conn: &Connection, account_id: i64, input: &PaymentMethodInput) -> Result<(), String> {
    let name = input.name.trim();
    let dup = conn
        .query_row(
            "SELECT 1 FROM payment_methods WHERE name = ?1 AND account_id = ?2 LIMIT 1",
            params![name, account_id],
            |_| Ok(()),
        )
        .optional()
        .map_err(db_err)?;
    if dup.is_some() {
        return Err("já existe forma de pagamento com esse nome".into());
    }
    conn.execute(
        "INSERT INTO payment_methods (account_id, name, type, metadata) VALUES (?1, ?2, ?3, ?4)",
        params![account_id, name, input.type_, metadata_for_payment_method(input)],
    )
    .map_err(db_err)?;
    Ok(())
}

fn metadata_for_payment_method(input: &PaymentMethodInput) -> Option<String> {
    if input.type_ != 2 {
        return None;
    }
    let close = input.close_day.unwrap_or(0);
    let validity = input.validity_day.unwrap_or(0);
    Some(
        serde_json::json!({ "close_day": close, "validity_day": validity }).to_string(),
    )
}

pub(crate) fn validate_payment_method(input: &PaymentMethodInput) -> Result<(), String> {
    if input.name.trim().is_empty() {
        return Err("nome é obrigatório".into());
    }
    if input.type_ != 1 && input.type_ != 2 {
        return Err("tipo inválido".into());
    }
    if let Some(d) = input.close_day {
        if !(1..=31).contains(&d) {
            return Err("dia de fechamento deve estar entre 1 e 31".into());
        }
    }
    Ok(())
}

pub(crate) fn update_payment_method(
    conn: &Connection,
    account_id: i64,
    id: i64,
    input: &PaymentMethodInput,
) -> Result<(), String> {
    let affected = conn
        .execute(
            "UPDATE payment_methods SET name = ?1, type = ?2, metadata = ?3 WHERE id = ?4 AND account_id = ?5",
            params![input.name.trim(), input.type_, metadata_for_payment_method(input), id, account_id],
        )
        .map_err(db_err)?;
    if affected == 0 {
        return Err("forma de pagamento não encontrada".into());
    }
    card_bills::refresh_card_bills(conn, account_id)?;
    Ok(())
}

pub(crate) fn delete_payment_methods(conn: &Connection, ids: &[i64]) -> Result<(), String> {
    let placeholders = vec!["?"; ids.len()].join(",");
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    conn.execute(
        &format!(
            "UPDATE payment_methods SET deleted_at = ?1, updated_at = ?1 WHERE id IN ({placeholders}) AND deleted_at IS NULL"
        ),
        rusqlite::params_from_iter(
            std::iter::once(Box::new(now.clone()) as Box<dyn rusqlite::types::ToSql>)
                .chain(ids.iter().map(|id| Box::new(*id) as Box<dyn rusqlite::types::ToSql>)),
        ),
    )
    .map_err(db_err)?;
    Ok(())
}

// ---- transactions helpers ----

pub fn create(conn: &Connection, account_id: i64, input: &TransactionInput) -> Result<(), String> {
    let description = input.description.trim();
    let dup = conn
        .query_row(
            "SELECT 1 FROM transactions
             WHERE description = ?1 AND amount = ?2 AND type = ?3 AND date = ?4
               AND category_id IS ?5 AND payment_method_id IS ?6 AND card_mode = ?7 AND in_principal = ?8
               AND fixed_bill_id IS NULL AND bill_start IS NULL AND account_id = ?9
             LIMIT 1",
            params![
                description,
                input.amount,
                input.type_,
                input.date,
                input.category_id,
                input.payment_method_id,
                input.card_mode,
                input.in_principal,
                account_id
            ],
            |_| Ok(()),
        )
        .optional()
        .map_err(db_err)?;
    if dup.is_some() {
        return Err("já existe transação idêntica nessa data".into());
    }
    conn.execute(
        "INSERT INTO transactions (account_id, description, amount, type, date, category_id, payment_method_id, card_mode, in_principal)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            account_id,
            description,
            input.amount,
            input.type_,
            input.date,
            input.category_id,
            input.payment_method_id,
            input.card_mode,
            input.in_principal
        ],
    )
    .map_err(db_err)?;
    refresh_card_bills(conn, account_id)?;
    Ok(())
}

pub fn update(conn: &Connection, id: i64, input: &TransactionInput) -> Result<(), String> {
    if card_bills::is_card_bill(conn, id)? {
        return Err("fatura é gerada automaticamente e não pode ser editada".into());
    }
    let affected = conn
        .execute(
            "UPDATE transactions SET description = ?1, amount = ?2, type = ?3, date = ?4,
                    category_id = ?5, payment_method_id = ?6, card_mode = ?7, in_principal = ?8
             WHERE id = ?9",
            params![
                input.description.trim(),
                input.amount,
                input.type_,
                input.date,
                input.category_id,
                input.payment_method_id,
                input.card_mode,
                input.in_principal,
                id
            ],
        )
        .map_err(db_err)?;
    if affected == 0 {
        return Err("transação não encontrada".into());
    }
    let account_id: i64 = conn
        .query_row("SELECT account_id FROM transactions WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(db_err)?;
    refresh_card_bills(conn, account_id)?;
    Ok(())
}

pub fn delete_ids(conn: &Connection, ids: &[i64]) -> Result<(), String> {
    for id in ids {
        if card_bills::is_card_bill(conn, *id)? {
            return Err("fatura é gerada automaticamente e não pode ser excluída".into());
        }
    }
    let placeholders = vec!["?"; ids.len()].join(",");
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let sql = format!(
        "UPDATE transactions SET deleted_at = ?1, updated_at = ?1 WHERE id IN ({placeholders}) AND deleted_at IS NULL"
    );
    conn.execute(
        &sql,
        rusqlite::params_from_iter(
            std::iter::once(Box::new(now) as Box<dyn rusqlite::types::ToSql>)
                .chain(ids.iter().map(|id| Box::new(*id) as Box<dyn rusqlite::types::ToSql>)),
        ),
    )
    .map_err(db_err)?;
    Ok(())
}

// ---- fixed_bills helpers ----

pub(crate) fn installment_index(start_month: &str, parcel_month: &str) -> i64 {
    month_diff(start_month, parcel_month).max(0) + 1
}

pub(crate) fn installment_finished(start_month: &str, installments: i64, row_month: &str) -> bool {
    installments >= 1 && installment_index(start_month, row_month) > installments
}

pub(crate) fn purchase_installment(purchase: &str) -> Result<(String, i64), String> {
    let d = NaiveDate::parse_from_str(purchase, "%Y-%m-%d")
        .map_err(|_| "data da compra inválida".to_string())?;
    Ok((d.format("%Y-%m").to_string(), d.day() as i64))
}

/// Gera transações das contas fixas ativas no mês. Dia clampado ao último dia.
pub fn generate_fixed_bills(conn: &Connection, account_id: i64, month: NaiveDate) -> Result<(), String> {
    let month_key = month.format("%Y-%m").to_string();
    let mut stmt = conn
        .prepare(
            "SELECT id, description, amount, day, category_id, payment_method_id, installments, start_month
             FROM fixed_bills
             WHERE start_month <= ?1 AND (end_month IS NULL OR end_month >= ?1) AND account_id = ?2",
        )
        .map_err(db_err)?;
    let bills = stmt
        .query_map(rusqlite::params![month_key, account_id], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, Option<i64>>(4)?,
                r.get::<_, i64>(5)?,
                r.get::<_, Option<i64>>(6)?,
                r.get::<_, String>(7)?,
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

    for (
        id,
        description,
        amount,
        day,
        category_id,
        payment_method_id,
        installments,
        start_month,
    ) in bills
    {
        if let Some(n) = installments {
            if month_diff(&start_month, &month_key) >= n {
                continue;
            }
        }
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
            "INSERT INTO transactions (account_id, description, amount, type, date, category_id, payment_method_id, fixed_bill_id, loan_id)
             VALUES (?1, ?2, ?3, 2, ?4, ?5, ?6, ?7, NULL)",
            rusqlite::params![account_id, description, amount, due, category_id, payment_method_id, id],
        )
        .map_err(db_err)?;
    }
    Ok(())
}

pub fn reconcile_fixed_bills(conn: &Connection, account_id: i64, start_month: &str, now: NaiveDate) -> Result<(), String> {
    let min = settings::earliest_month(conn, account_id)?.min(start_month.to_string());
    let mut m = parse_month(&min)?;
    while m <= now {
        generate_fixed_bills(conn, account_id, m)?;
        m = m.checked_add_months(Months::new(1)).unwrap();
    }
    refresh_card_bills(conn, account_id)
}

fn apply_card_day(conn: &Connection, input: &mut FixedBillInput) -> Result<(), String> {
    let pm: Option<(i64, Option<String>)> = conn
        .query_row(
            "SELECT type, metadata FROM payment_methods WHERE id = ?1",
            params![input.payment_method_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(db_err)?;
    if let Some((ty, meta)) = pm {
        if ty == 2 {
            let cd: Option<i64> = meta
                .as_deref()
                .and_then(|m| serde_json::from_str::<serde_json::Value>(m).ok())
                .and_then(|v| v.get("close_day")?.as_i64());
            if let Some(cd) = cd {
                if cd > 0 {
                    input.day = cd;
                }
            }
        }
    }
    Ok(())
}

fn apply_purchase_date(input: &mut FixedBillInput) -> Result<(), String> {
    if let Some(pd) = input.purchase_date.clone() {
        let (start_month, day) = purchase_installment(&pd)?;
        input.start_month = start_month;
        input.day = day;
    }
    Ok(())
}

pub(crate) fn finalize_installments(conn: &Connection, input: &mut FixedBillInput) -> Result<(), String> {
    if input.purchase_date.is_some() {
        apply_purchase_date(input)?;
    } else {
        apply_card_day(conn, input)?;
    }
    if input.installments.is_some() {
        *input = input.normalized()?;
    }
    Ok(())
}

pub fn create_fixed_bill(conn: &Connection, account_id: i64, input: &mut FixedBillInput) -> Result<(), String> {
    finalize_installments(conn, input)?;
    input.validate()?;
    let description = input.description.trim();
    let dup = conn
        .query_row(
            "SELECT 1 FROM fixed_bills
             WHERE description = ?1 AND amount = ?2 AND day = ?3 AND start_month = ?4
               AND payment_method_id = ?5 AND installments IS ?6 AND account_id = ?7
             LIMIT 1",
            params![
                description,
                input.amount,
                input.day,
                input.start_month,
                input.payment_method_id,
                input.installments,
                account_id
            ],
            |_| Ok(()),
        )
        .optional()
        .map_err(db_err)?;
    if dup.is_some() {
        return Err("já existe conta fixa idêntica nesse mês".into());
    }
    let end_month = input.end_month.clone();
    conn.execute(
        "INSERT INTO fixed_bills (account_id, description, amount, day, category_id, payment_method_id, start_month, end_month, installments, purchase_date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            account_id,
            description,
            input.amount,
            input.day,
            input.category_id,
            input.payment_method_id,
            input.start_month,
            end_month,
            input.installments,
            input.purchase_date
        ],
    )
    .map_err(db_err)?;
    reconcile_fixed_bills(conn, account_id, &input.start_month, chrono::Local::now().date_naive())?;
    Ok(())
}

// ---- loans helpers ----

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
pub fn loan_schedule(
    principal: i64,
    installment: i64,
    n: i64,
    start_month: &str,
    rate: f64,
    as_of_month: &str,
) -> Vec<AmortizationRow> {
    let rate = if rate > 0.0 {
        rate
    } else {
        loan_monthly_rate(principal, installment, n)
    };
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
        let t = month_diff(as_of_month, &month);
        let settlement = if t > 0 {
            (installment as f64 / (1.0 + rate).powf(t as f64)).round() as i64
        } else {
            0
        };
        rows.push(AmortizationRow {
            number: k,
            month,
            installment: paid,
            interest,
            principal: p,
            balance,
            settlement,
        });
    }
    rows
}

/// Gera entrada (empréstimos) e parcelas mensais dos empréstimos ativos no mês.
pub fn generate_loan_installments(conn: &Connection, account_id: i64, month: NaiveDate) -> Result<(), String> {
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
             FROM loans WHERE account_id = ?1",
        )
        .map_err(db_err)?;
    let loans = stmt
        .query_map(params![account_id], |r| {
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
                    "INSERT INTO transactions (account_id, description, amount, type, date, payment_method_id, loan_id)
                     VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6)",
                    rusqlite::params![
                        account_id,
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
            let due_day = day.min(crate::shared::card_bills::last_day_of(month) as i64) as u32;
            let due = month.with_day(due_day).unwrap().format("%Y-%m-%d").to_string();
            conn.execute(
                "INSERT INTO transactions (account_id, description, amount, type, date, payment_method_id, loan_id)
                 VALUES (?1, ?2, ?3, 2, ?4, ?5, ?6)",
                rusqlite::params![account_id, description, installment, due, pm_id, id],
            )
            .map_err(db_err)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::{add_pm, test_db};
    use rusqlite::{params, Connection};

    fn base_input() -> FixedBillInput {
        FixedBillInput {
            description: "compra".into(),
            amount: 1000,
            day: 1,
            category_id: None,
            payment_method_id: 0,
            start_month: "2026-08".into(),
            end_month: None,
            installments: Some(3),
            purchase_date: None,
        }
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
    fn installment_index_counts_from_start() {
        assert_eq!(installment_index("2026-05", "2026-05"), 1);
        assert_eq!(installment_index("2026-05", "2026-06"), 2);
        assert_eq!(installment_index("2026-05", "2026-07"), 3);
        assert_eq!(installment_index("2025-11", "2026-07"), 9);
        assert_eq!(installment_index("2026-07", "2026-05"), 1);
    }

    #[test]
    fn installment_finished_edges() {
        assert!(!installment_finished("2026-01", 3, "2026-01")); // 1/3
        assert!(!installment_finished("2026-01", 3, "2026-03")); // 3/3, último
        assert!(installment_finished("2026-01", 3, "2026-04")); // 4/3, passou
        assert!(!installment_finished("2026-01", 3, "2025-12")); // antes do início → index 1
        assert!(!installment_finished("2026-01", 0, "2026-04")); // total inválido
    }

    #[test]
    fn finalize_deriva_end_month_do_mes_da_compra() {
        let conn = test_db();
        conn.execute(
            "INSERT INTO payment_methods (name, type, metadata) VALUES ('Nubank', 2, NULL)",
            [],
        )
        .unwrap();
        let card_id = conn.last_insert_rowid();
        let mut input = base_input();
        input.payment_method_id = card_id;
        input.purchase_date = Some("2026-05-20".into());

        finalize_installments(&conn, &mut input).unwrap();

        assert_eq!(input.start_month, "2026-05");
        assert_eq!(input.day, 20);
        assert_eq!(input.end_month.as_deref(), Some("2026-07"));
    }

    #[test]
    fn finalize_cartao_sem_compra_usa_dia_de_fechamento() {
        let conn = test_db();
        conn.execute(
            "INSERT INTO payment_methods (name, type, metadata) VALUES ('Nubank', 2, '{\"close_day\": 10}')",
            [],
        )
        .unwrap();
        let card_id = conn.last_insert_rowid();
        let mut input = base_input();
        input.payment_method_id = card_id;
        input.day = 1;

        finalize_installments(&conn, &mut input).unwrap();

        assert_eq!(input.day, 10, "dia vira o de fechamento do cartão");
        assert_eq!(input.start_month, "2026-08");
        assert_eq!(
            input.end_month.as_deref(),
            Some("2026-10"),
            "end deriva do start do formulário"
        );
    }

    #[test]
    fn finalize_sem_parcelas_preserva_end_month() {
        let conn = test_db();
        let mut input = base_input();
        input.installments = None;
        input.end_month = Some("2027-01".into());

        finalize_installments(&conn, &mut input).unwrap();

        assert_eq!(
            input.end_month.as_deref(),
            Some("2027-01"),
            "end_month manual preservado"
        );
        assert_eq!(input.day, 1, "sem compra nem cartão, dia inalterado");
    }

    #[test]
    fn generate_stops_at_installments_count() {
        let conn = test_db();
        let pm = add_pm(&conn, "PIX", 1, None);
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
             VALUES ('parcela', 1000, 10, ?1, '2026-01', '2026-06', 3)",
            params![pm],
        )
        .unwrap();

        generate_fixed_bills(&conn, 1, NaiveDate::from_ymd_opt(2026, 3, 1).unwrap()).unwrap();
        generate_fixed_bills(&conn, 1, NaiveDate::from_ymd_opt(2026, 4, 1).unwrap()).unwrap();

        let rows: i64 = conn
            .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
            .unwrap();
        assert_eq!(rows, 1, "março (3/3) gera; abril (4/3) para");
    }

    #[test]
    fn reconcile_generates_bills_in_empty_months() {
        let conn = test_db();
        let pix = add_pm(&conn, "PIX", 1, None);
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, category_id, payment_method_id, start_month, end_month, installments)
             VALUES ('Internet', 12000, 5, NULL, ?1, '2026-05', NULL, NULL)",
            params![pix],
        )
        .unwrap();
        let bill_id = conn.last_insert_rowid();

        reconcile_fixed_bills(&conn, 1, "2026-05", NaiveDate::from_ymd_opt(2026, 7, 1).unwrap()).unwrap();

        let dates: Vec<String> = {
            let mut stmt = conn
                .prepare("SELECT date FROM transactions WHERE fixed_bill_id = ?1 ORDER BY date")
                .unwrap();
            let rows = stmt
                .query_map(params![bill_id], |r| r.get(0))
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap();
            rows
        };
        assert_eq!(dates, vec!["2026-05-05", "2026-06-05", "2026-07-05"]);
    }

    #[test]
    fn reconcile_starts_at_bill_month_when_no_transactions() {
        let conn = test_db();
        let pix = add_pm(&conn, "PIX", 1, None);
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, category_id, payment_method_id, start_month, end_month, installments)
             VALUES ('Aluguel', 80000, 10, NULL, ?1, '2026-06', NULL, NULL)",
            params![pix],
        )
        .unwrap();
        let bill_id = conn.last_insert_rowid();

        reconcile_fixed_bills(&conn, 1, "2026-06", NaiveDate::from_ymd_opt(2026, 8, 1).unwrap()).unwrap();

        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE fixed_bill_id = ?1",
                params![bill_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 3);
    }

    #[test]
    fn migration_007_corrige_end_month_legado() {
        use rusqlite_migration::{M, Migrations};

        let mut conn = Connection::open_in_memory().unwrap();
        Migrations::new(vec![M::up(include_str!("../../migrations/001_init.sql"))])
            .to_latest(&mut conn)
            .unwrap();
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
             VALUES ('legado', 1000, 20, 1, '2026-03', '2026-12', 5)",
            [],
        )
        .unwrap();

        conn.execute_batch(include_str!("../../migrations/007_fixed_bill_end_month.sql"))
            .unwrap();

        let end: String = conn
            .query_row("SELECT end_month FROM fixed_bills", [], |r| r.get(0))
            .unwrap();
        assert_eq!(end, "2026-07", "end_month recalculado a partir do start_month");
    }
}
