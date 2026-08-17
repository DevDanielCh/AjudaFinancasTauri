use crate::organizacao_financeira::models::{Category, FixedBill, Loan, LoanInput, PaymentMethod};
use crate::shared::util::{current_month, db_err, order_clause};
use rusqlite::{params, Connection, OptionalExtension};

use super::service;

pub(crate) fn list_categories(
    conn: &Connection,
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<Vec<Category>, String> {
    let order = order_clause(
        sort_by,
        sort_dir,
        &[("name", "name"), ("type", "type"), ("color", "color")],
        "ORDER BY name",
        "id DESC",
    );
    let mut stmt = conn
        .prepare(&format!("SELECT id, name, type, color, icon FROM categories {order}"))
        .map_err(db_err)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Category {
                id: r.get(0)?,
                name: r.get(1)?,
                type_: r.get(2)?,
                color: r.get(3)?,
                icon: r.get(4)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(rows)
}

pub(crate) fn list_payment_methods(
    conn: &Connection,
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<Vec<PaymentMethod>, String> {
    let order = order_clause(
        sort_by,
        sort_dir,
        &[("name", "name"), ("type", "type")],
        "ORDER BY name",
        "id DESC",
    );
    let mut stmt = conn
        .prepare(&format!("SELECT id, name, type, metadata FROM payment_methods {order}"))
        .map_err(db_err)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(PaymentMethod {
                id: r.get(0)?,
                name: r.get(1)?,
                type_: r.get(2)?,
                metadata: r.get(3)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(rows)
}

pub(crate) fn list_fixed_bills(
    conn: &Connection,
    only_installments: bool,
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<Vec<FixedBill>, String> {
    let (cond, default) = if only_installments {
        ("b.installments IS NOT NULL", "ORDER BY b.start_month DESC, b.id DESC")
    } else {
        ("b.installments IS NULL", "ORDER BY b.start_month ASC, b.id ASC")
    };
    let order = order_clause(
        sort_by,
        sort_dir,
        &[
            ("description", "b.description"),
            ("amount", "b.amount"),
            ("day", "b.day"),
            ("start", "b.start_month"),
            ("end", "b.end_month"),
            ("installments", "b.installments"),
        ],
        default,
        "b.id DESC",
    );
    let sql = format!(
        "SELECT b.id, b.description, b.amount, b.day, b.category_id, c.name,
                b.payment_method_id, pm.name, b.start_month, b.end_month, b.installments, b.purchase_date
         FROM fixed_bills b
         LEFT JOIN categories c ON c.id = b.category_id
         JOIN payment_methods pm ON pm.id = b.payment_method_id
         WHERE {cond}
         {order}"
    );
    let mut stmt = conn.prepare(&sql).map_err(db_err)?;
    let mut rows = stmt
        .query_map([], |r| {
            Ok(FixedBill {
                id: r.get(0)?,
                description: r.get(1)?,
                amount: r.get(2)?,
                day: r.get(3)?,
                category_id: r.get(4)?,
                category_name: r.get(5)?,
                payment_method_id: r.get(6)?,
                payment_method_name: r.get(7)?,
                start_month: r.get(8)?,
                end_month: r.get(9)?,
                installments: r.get(10)?,
                purchase_date: r.get(11)?,
                finished: false,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    let now = current_month();
    for b in &mut rows {
        if let Some(n) = b.installments {
            b.finished = super::service::installment_finished(&b.start_month, n, &now);
        }
    }
    Ok(rows)
}

pub(crate) fn build_loan(input: &LoanInput) -> Loan {
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

pub(crate) fn list_loans(
    conn: &Connection,
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<Vec<Loan>, String> {
    let order = order_clause(
        sort_by,
        sort_dir,
        &[
            ("description", "l.description"),
            ("type", "l.type"),
            ("principal", "l.principal"),
            ("installment", "l.installment"),
            ("installments", "l.total_installments"),
            ("start", "l.start_month"),
        ],
        "ORDER BY l.start_month DESC, l.id DESC",
        "l.id DESC",
    );
    let mut stmt = conn
        .prepare(&format!(
            "SELECT l.id, l.type, l.description, l.principal, l.installment,
                    l.total_installments, l.day, l.start_month, l.payment_method_id, pm.name, l.monthly_rate
             FROM loans l JOIN payment_methods pm ON pm.id = l.payment_method_id
             {order}"
        ))
        .map_err(db_err)?;
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
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;

    let mut out = Vec::with_capacity(raw.len());
    for (id, ty, description, principal, installment, total_n, day, start_month, pm_id, pm_name, stored_rate) in raw {
        let paid_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE loan_id = ?1 AND type = 2",
                params![id],
                |r| r.get(0),
            )
            .map_err(db_err)?;
        let monthly_rate = stored_rate.unwrap_or_else(|| {
            service::loan_monthly_rate(principal, installment, total_n)
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

pub(crate) fn get_loan_detail(
    conn: &Connection,
    id: i64,
) -> Result<Loan, String> {
    let raw: Option<(i64, i64, String, i64, i64, i64, i64, String, i64, String, Option<f64>)> = conn
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
        .map_err(db_err)?;
    let Some((id, ty, description, principal, installment, total_n, day, start_month, pm_id, pm_name, stored_rate)) = raw else {
        return Err("empréstimo não encontrado".into());
    };
    let monthly_rate = stored_rate.unwrap_or_else(|| {
        service::loan_monthly_rate(principal, installment, total_n)
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
    let loan = build_loan(&input);
    let loan = Loan {
        payment_method_name: pm_name,
        paid_count: conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE loan_id = ?1 AND type = 2",
                params![id],
                |r| r.get(0),
            )
            .map_err(db_err)?,
        ..loan
    };
    Ok(loan)
}

pub fn create_loan(conn: &Connection, input: &LoanInput, rate: f64) -> Result<(), String> {
    let description = input.description.trim();
    let dup = conn
        .query_row(
            "SELECT 1 FROM loans
             WHERE description = ?1 AND principal = ?2 AND start_month = ?3
             LIMIT 1",
            params![description, input.principal, input.start_month],
            |_| Ok(()),
        )
        .optional()
        .map_err(db_err)?;
    if dup.is_some() {
        return Err("já existe empréstimo idêntico nesse mês".into());
    }
    conn.execute(
        "INSERT INTO loans (type, description, principal, installment, total_installments, day, start_month, payment_method_id, monthly_rate)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            input.type_,
            description,
            input.principal,
            input.installment,
            input.total_installments,
            input.day,
            input.start_month,
            input.payment_method_id,
            rate
        ],
    )
    .map_err(db_err)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;
    use rusqlite::{params, Connection};

    fn test_db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        migrations().to_latest(&mut conn).unwrap();
        conn
    }

    #[test]
    fn list_marca_finished_quando_plano_encerrou() {
        let conn = test_db();
        conn.execute("INSERT INTO payment_methods (name, type) VALUES ('PIX', 1)", [])
            .unwrap();
        let pm_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
             VALUES ('antigo', 1000, 10, ?1, '2020-01', '2020-03', 3)",
            params![pm_id],
        )
        .unwrap();
        let now = chrono::Local::now().date_naive().format("%Y-%m").to_string();
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
             VALUES ('novo', 1000, 10, ?1, ?2, ?2, 3)",
            params![pm_id, now],
        )
        .unwrap();

        let rows = list_fixed_bills(&conn, true, None, None).unwrap();

        let antigo = rows.iter().find(|b| b.description == "antigo").expect("antigo presente");
        assert!(antigo.finished, "plano encerrado deve marcar finished");
        let novo = rows.iter().find(|b| b.description == "novo").expect("novo presente");
        assert!(!novo.finished, "plano corrente não está finished");
    }
}
