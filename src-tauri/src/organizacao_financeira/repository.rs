use crate::shared::card_bills::FINISHED_GUARD_SQL;
use crate::organizacao_financeira::models::{Category, FixedBill, Loan, LoanInput, PaymentMethod, TransactionRow};
use crate::shared::card_bills;
use crate::shared::util::{current_month, db_err, month_range, order_clause, parse_month};
use rusqlite::{params, Connection, OptionalExtension};

use super::service;

pub(crate) fn list_transactions(
    conn: &Connection,
    account_id: i64,
    month: Option<&str>,
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<Vec<TransactionRow>, String> {
    let (start, end, ref_month) = match month {
        Some(m) if !m.is_empty() => {
            let (s, e) = month_range(m)?;
            (Some(s), Some(e), Some(parse_month(m)?))
        }
        _ => (None, None, None),
    };
    if let Some(m) = ref_month {
        card_bills::ensure_card_bills(conn, account_id, m)?;
    }
    let mut sql = String::from(
        "SELECT t.id, t.description, t.amount, t.type, t.date,
                t.category_id, c.name, t.payment_method_id, pm.name,
                t.fixed_bill_id, t.loan_id, (t.bill_start IS NOT NULL), t.card_mode
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id AND c.deleted_at IS NULL
         LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id AND pm.deleted_at IS NULL
         WHERE t.deleted_at IS NULL AND t.account_id = ?1",
    );
    if start.is_some() {
        sql.push_str(" AND t.date >= ?2 AND t.date < ?3");
    }
    sql.push_str(&format!(" {}", order_clause(
        sort_by,
        sort_dir,
        &[
            ("date", "t.date"),
            ("type", "t.type"),
            ("description", "t.description"),
            ("category", "c.name"),
            ("payment_method", "pm.name"),
            ("amount", "t.amount"),
        ],
        "ORDER BY t.date DESC, t.id DESC",
        "t.id DESC",
    )));
    let mut stmt = conn.prepare(&sql).map_err(db_err)?;
    let start_s = start.map(|d| d.format("%Y-%m-%d").to_string());
    let end_s = end.map(|d| d.format("%Y-%m-%d").to_string());
    let params: &[&dyn rusqlite::ToSql] = if start_s.is_some() {
        &[&account_id, &start_s, &end_s]
    } else {
        &[&account_id]
    };
    let rows = stmt
        .query_map(params, |r| {
                Ok(TransactionRow {
                    id: r.get(0)?,
                    description: r.get(1)?,
                    amount: r.get(2)?,
                    type_: r.get(3)?,
                    date: r.get(4)?,
                    category_id: r.get(5)?,
                    category_name: r.get(6)?,
                    payment_method_id: r.get(7)?,
                    payment_method_name: r.get(8)?,
                    fixed_bill_id: r.get(9)?,
                    loan_id: r.get(10)?,
                    is_card_bill: r.get(11)?,
                    card_mode: r.get(12)?,
                    installment: None,
                })
            },
        )
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    let card_ids = card_bills::fatura_capable_card_ids(conn, account_id)?;
    Ok(rows
        .into_iter()
        // Fatura substitui o crédito; débito aparece como despesa normal.
        .filter(|r| {
            r.is_card_bill
                || r.payment_method_id.is_none_or(|id| !card_ids.contains(&id))
                || r.card_mode == 1
        })
        .collect())
}

/// Compras de crédito que compõem a fatura (card_mode = 0) no período.
pub fn card_bill_purchases(
    conn: &Connection,
    pm_id: i64,
    bill_start: &str,
    bill_end: &str,
) -> Result<Vec<TransactionRow>, String> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT t.id, t.description, t.amount, t.type, t.date,
                    t.category_id, cat.name, t.payment_method_id, pm.name,
                    t.fixed_bill_id, t.loan_id, 0, t.card_mode,
                    fb.installments, fb.start_month
             FROM transactions t
             LEFT JOIN categories cat ON cat.id = t.category_id AND cat.deleted_at IS NULL
             LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id AND pm.deleted_at IS NULL
             LEFT JOIN fixed_bills fb ON fb.id = t.fixed_bill_id AND fb.deleted_at IS NULL
             WHERE t.payment_method_id = ?1 AND t.bill_start IS NULL
               AND t.card_mode = 0
               AND t.date >= ?2 AND t.date < ?3
               AND t.deleted_at IS NULL
               AND ({})
             ORDER BY t.date ASC, t.id ASC",
            FINISHED_GUARD_SQL
        ))
        .map_err(db_err)?;
    let txs = stmt
        .query_map(params![pm_id, bill_start, bill_end], |r| {
            let date: String = r.get(4)?;
            let installments: Option<i64> = r.get(13)?;
            let start_month: Option<String> = r.get(14)?;
            let installment = match (installments, start_month) {
                (Some(total), Some(sm)) if total >= 1 => {
                    Some(format!("{}/{}", crate::organizacao_financeira::service::installment_index(&sm, &date[..7]), total))
                }
                _ => None,
            };
            Ok(TransactionRow {
                id: r.get(0)?,
                description: r.get(1)?,
                amount: r.get(2)?,
                type_: r.get(3)?,
                date,
                category_id: r.get(5)?,
                category_name: r.get(6)?,
                payment_method_id: r.get(7)?,
                payment_method_name: r.get(8)?,
                fixed_bill_id: r.get(9)?,
                loan_id: r.get(10)?,
                is_card_bill: false,
                card_mode: r.get(12)?,
                installment,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(txs)
}

pub(crate) fn get_card_bill_query(
    conn: &Connection,
    id: i64,
) -> Result<(i64, String, Option<String>, Option<String>, String, String), String> {
    let row: Option<(i64, String, Option<String>, Option<String>, String, String)> = conn
        .query_row(
            "SELECT t.payment_method_id, pm.name, t.bill_start, t.bill_end, t.date, t.description
             FROM transactions t
             LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id AND pm.deleted_at IS NULL
             WHERE t.id = ?1 AND t.deleted_at IS NULL",
            params![id],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                ))
            },
        )
        .optional()
        .map_err(db_err)?;
    row.ok_or_else(|| "fatura não encontrada".into())
}

pub(crate) fn list_categories(
    conn: &Connection,
    account_id: i64,
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
        .prepare(&format!(
            "SELECT id, name, type, color, icon FROM categories WHERE deleted_at IS NULL AND account_id = ?1 {order}"
        ))
        .map_err(db_err)?;
    let rows = stmt
        .query_map(params![account_id], |r| {
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
    account_id: i64,
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
        .prepare(&format!(
            "SELECT id, name, type, metadata FROM payment_methods WHERE deleted_at IS NULL AND account_id = ?1 {order}"
        ))
        .map_err(db_err)?;
    let rows = stmt
        .query_map(params![account_id], |r| {
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
    account_id: i64,
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
         LEFT JOIN categories c ON c.id = b.category_id AND c.deleted_at IS NULL
         JOIN payment_methods pm ON pm.id = b.payment_method_id AND pm.deleted_at IS NULL
         WHERE b.deleted_at IS NULL AND b.account_id = ?1 AND {cond}
         {order}"
    );
    let mut stmt = conn.prepare(&sql).map_err(db_err)?;
    let mut rows = stmt
        .query_map(params![account_id], |r| {
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
    account_id: i64,
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
             FROM loans l JOIN payment_methods pm ON pm.id = l.payment_method_id AND pm.deleted_at IS NULL
             WHERE l.deleted_at IS NULL AND l.account_id = ?1
             {order}"
        ))
        .map_err(db_err)?;
    let raw = stmt
        .query_map(params![account_id], |r| {
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
             FROM loans l JOIN payment_methods pm ON pm.id = l.payment_method_id AND pm.deleted_at IS NULL
             WHERE l.id = ?1 AND l.deleted_at IS NULL",
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

pub fn create_loan(conn: &Connection, account_id: i64, input: &LoanInput, rate: f64) -> Result<(), String> {
    let description = input.description.trim();
    let dup = conn
        .query_row(
            "SELECT 1 FROM loans
             WHERE description = ?1 AND principal = ?2 AND start_month = ?3 AND account_id = ?4
             LIMIT 1",
            params![description, input.principal, input.start_month, account_id],
            |_| Ok(()),
        )
        .optional()
        .map_err(db_err)?;
    if dup.is_some() {
        return Err("já existe empréstimo idêntico nesse mês".into());
    }
    conn.execute(
        "INSERT INTO loans (account_id, type, description, principal, installment, total_installments, day, start_month, payment_method_id, monthly_rate)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            account_id,
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

        let rows = list_fixed_bills(&conn, 1, true, None, None).unwrap();

        let antigo = rows.iter().find(|b| b.description == "antigo").expect("antigo presente");
        assert!(antigo.finished, "plano encerrado deve marcar finished");
        let novo = rows.iter().find(|b| b.description == "novo").expect("novo presente");
        assert!(!novo.finished, "plano corrente não está finished");
    }

    fn add_pm(conn: &Connection, name: &str, ty: i64, meta: Option<&str>) -> i64 {
        conn.execute(
            "INSERT INTO payment_methods (name, type, metadata) VALUES (?1, ?2, ?3)",
            params![name, ty, meta],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    #[test]
    fn list_mostra_debito_e_esconde_credito_do_cartao() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        let pix = add_pm(&conn, "PIX", 1, None);
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, card_mode)
             VALUES ('debito', 3000, 2, '2026-06-15', ?1, 1)",
            params![card],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id)
             VALUES ('credito', 5000, 2, '2026-06-05', ?1)",
            params![card],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id)
             VALUES ('fatura', 5000, 3, '2026-06-20', ?1)",
            params![card],
        )
        .unwrap();
        conn.execute(
            "UPDATE transactions SET bill_start = '2026-05-10', bill_end = '2026-06-10' WHERE description = 'fatura'",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id)
             VALUES ('pix', 100, 2, '2026-06-05', ?1)",
            params![pix],
        )
        .unwrap();

        let rows = list_transactions(&conn, 1, None, None, None).unwrap();

        let debit = rows.iter().find(|r| r.description == "debito").expect("débito deve aparecer");
        assert_eq!(debit.card_mode, 1);
        assert!(rows.iter().all(|r| r.description != "credito"), "crédito deve sumir da listagem");
        let fatura = rows.iter().find(|r| r.description == "fatura").expect("fatura deve aparecer");
        assert!(fatura.is_card_bill);
        assert!(rows.iter().any(|r| r.description == "pix"), "forma normal deve aparecer");
    }

    #[test]
    fn fatura_detalhe_exclui_parcela_encerrada() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
             VALUES ('parcela', 1000, 10, ?1, '2026-01', '2026-06', 3)",
            params![card],
        )
        .unwrap();
        let fb_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, fixed_bill_id, card_mode)
             VALUES ('fantasma', 4000, 2, '2026-06-15', ?1, ?2, 0)",
            params![card, fb_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, card_mode)
             VALUES ('avulsa', 5000, 2, '2026-06-15', ?1, 0)",
            params![card],
        )
        .unwrap();

        let txs = card_bill_purchases(&conn, card, "2026-06-10", "2026-07-10").unwrap();

        assert!(txs.iter().any(|t| t.description == "avulsa"));
        assert!(
            txs.iter().all(|t| t.description != "fantasma"),
            "parcela além do total não pode aparecer no detalhe"
        );
        assert_eq!(txs.iter().map(|t| t.amount).sum::<i64>(), 5000);
    }

    #[test]
    fn list_transactions_ordena_por_valor() {
        let conn = test_db();
        let pix = add_pm(&conn, "PIX", 1, None);
        for (desc, amount) in [("a", 100), ("c", 300), ("b", 200)] {
            conn.execute(
                "INSERT INTO transactions (description, amount, type, date, payment_method_id)
                 VALUES (?1, ?2, 2, '2026-06-05', ?3)",
                params![desc, amount, pix],
            )
            .unwrap();
        }
        let rows = list_transactions(&conn, 1, None, Some("amount"), Some("asc")).unwrap();
        let amounts: Vec<i64> = rows.iter().map(|r| r.amount).collect();
        assert_eq!(amounts, vec![100, 200, 300]);
    }
}
