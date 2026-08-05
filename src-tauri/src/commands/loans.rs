use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::{Loan, LoanDetail, LoanInput};
use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

#[tauri::command]
pub async fn list_loans(state: State<'_, AppState>) -> Result<Vec<Loan>, String> {
    with_db(&state, list)
}

fn list(conn: &Connection) -> Result<Vec<Loan>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT l.id, l.type, l.description, l.principal, l.installment,
                    l.total_installments, l.day, l.start_month, l.payment_method_id, pm.name, l.monthly_rate
             FROM loans l JOIN payment_methods pm ON pm.id = l.payment_method_id
             ORDER BY l.start_month DESC, l.id DESC",
        )
        .map_err(domain::db_err)?;
    let raw = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, i64>(5)?,
                r.get::<_, i64>(6)?,
                r.get::<_, String>(7)?,
                r.get::<_, i64>(8)?,
                r.get::<_, String>(9)?,
                r.get::<_, Option<f64>>(10)?,
            ))
        })
        .map_err(domain::db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(domain::db_err)?;

    let mut out = Vec::with_capacity(raw.len());
    for (id, ty, description, principal, installment, total_n, day, start_month, pm_id, pm_name, stored_rate) in raw {
        let paid_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE loan_id = ?1 AND type = 2",
                params![id],
                |r| r.get(0),
            )
            .map_err(domain::db_err)?;
        let monthly_rate = stored_rate.unwrap_or_else(|| {
            domain::loan_monthly_rate(principal, installment, total_n)
        });
        out.push(Loan {
            id,
            type_: ty,
            description: description.clone(),
            principal,
            installment,
            total_installments: total_n,
            day,
            start_month: start_month.clone(),
            payment_method_id: pm_id,
            payment_method_name: pm_name,
            total_paid: installment * total_n,
            total_interest: installment * total_n - principal,
            end_month: LoanInput {
                type_: ty,
                description,
                principal,
                installment,
                total_installments: total_n,
                day,
                start_month,
                payment_method_id: pm_id,
                monthly_rate,
            }
            .end_month(),
            paid_count,
            monthly_rate,
        });
    }
    Ok(out)
}

fn build(input: &LoanInput) -> Loan {
    Loan {
        id: 0,
        type_: input.type_,
        description: input.description.clone(),
        principal: input.principal,
        installment: input.installment,
        total_installments: input.total_installments,
        day: input.day,
        start_month: input.start_month.clone(),
        payment_method_id: input.payment_method_id,
        payment_method_name: String::new(),
        total_paid: input.total_paid(),
        total_interest: input.total_paid() - input.principal,
        end_month: input.end_month(),
        paid_count: 0,
        monthly_rate: input.monthly_rate,
    }
}

#[tauri::command]
pub async fn get_loan_detail(state: State<'_, AppState>, id: i64) -> Result<LoanDetail, String> {
    with_db(&state, |c| {
        let raw: Option<(i64, i64, String, i64, i64, i64, i64, String, i64, String, Option<f64>)> = c
            .query_row(
                "SELECT l.id, l.type, l.description, l.principal, l.installment,
                        l.total_installments, l.day, l.start_month, l.payment_method_id, pm.name, l.monthly_rate
                 FROM loans l JOIN payment_methods pm ON pm.id = l.payment_method_id
                 WHERE l.id = ?1",
                params![id],
                |r| {
                    Ok((
                        r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?,
                        r.get(5)?, r.get(6)?, r.get(7)?, r.get(8)?, r.get(9)?, r.get(10)?,
                    ))
                },
            )
            .optional()
            .map_err(domain::db_err)?;
        let Some((id, ty, description, principal, installment, total_n, day, start_month, pm_id, pm_name, stored_rate)) = raw else {
            return Err("empréstimo não encontrado".into());
        };
        let monthly_rate = stored_rate.unwrap_or_else(|| {
            domain::loan_monthly_rate(principal, installment, total_n)
        });
        let input = LoanInput {
            type_: ty,
            description,
            principal,
            installment,
            total_installments: total_n,
            day,
            start_month: start_month.clone(),
            payment_method_id: pm_id,
            monthly_rate,
        };
        let loan = build(&input);
        let loan = Loan {
            payment_method_name: pm_name,
            paid_count: c
                .query_row(
                    "SELECT COUNT(*) FROM transactions WHERE loan_id = ?1 AND type = 2",
                    params![id],
                    |r| r.get(0),
                )
                .map_err(domain::db_err)?,
            ..loan
        };
        let schedule = domain::loan_schedule(
            input.principal,
            input.installment,
            input.total_installments,
            &input.start_month,
            monthly_rate,
            &domain::current_month(),
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
            domain::loan_monthly_rate(input.principal, input.installment, input.total_installments)
        };
        c.execute(
            "INSERT INTO loans (type, description, principal, installment, total_installments, day, start_month, payment_method_id, monthly_rate)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                input.type_,
                input.description.trim(),
                input.principal,
                input.installment,
                input.total_installments,
                input.day,
                input.start_month,
                input.payment_method_id,
                rate
            ],
        )
        .map_err(domain::db_err)?;
        Ok(())
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
            domain::loan_monthly_rate(input.principal, input.installment, input.total_installments)
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
            .map_err(domain::db_err)?;
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
        let placeholders = vec!["?"; ids.len()].join(",");
        c.execute(
            &format!("DELETE FROM transactions WHERE loan_id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(domain::db_err)?;
        c.execute(
            &format!("DELETE FROM loans WHERE id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(domain::db_err)?;
        domain::refresh_card_bills(c)
    })
}
