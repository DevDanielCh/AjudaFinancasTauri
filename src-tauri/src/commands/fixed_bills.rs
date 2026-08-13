use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::{FixedBill, FixedBillInput};
use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

#[tauri::command]
pub async fn list_fixed_bills(
    state: State<'_, AppState>,
    only_installments: bool,
) -> Result<Vec<FixedBill>, String> {
    with_db(&state, |c| list(c, only_installments))
}

fn list(conn: &Connection, only_installments: bool) -> Result<Vec<FixedBill>, String> {
    let (cond, order) = if only_installments {
        ("b.installments IS NOT NULL", "b.start_month DESC, b.id DESC")
    } else {
        ("b.installments IS NULL", "b.start_month ASC, b.id ASC")
    };
    let sql = format!(
        "SELECT b.id, b.description, b.amount, b.day, b.category_id, c.name,
                b.payment_method_id, pm.name, b.start_month, b.end_month, b.installments, b.purchase_date
         FROM fixed_bills b
         LEFT JOIN categories c ON c.id = b.category_id
         JOIN payment_methods pm ON pm.id = b.payment_method_id
         WHERE {cond}
         ORDER BY {order}"
    );
    let mut stmt = conn.prepare(&sql).map_err(domain::db_err)?;
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
        .map_err(domain::db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(domain::db_err)?;
    let now = domain::current_month();
    for b in &mut rows {
        if let Some(n) = b.installments {
            b.finished = domain::installment_finished(&b.start_month, n, &now);
        }
    }
    Ok(rows)
}

/// Se a forma de pagamento é cartão com dia de fechamento, o dia da conta vira o de fechamento.
fn apply_card_day(conn: &Connection, input: &mut FixedBillInput) -> Result<(), String> {
    let pm: Option<(i64, Option<String>)> = conn
        .query_row(
            "SELECT type, metadata FROM payment_methods WHERE id = ?1",
            params![input.payment_method_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(domain::db_err)?;
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

/// Deriva mês/dia do parcelamento a partir da data da compra.
fn apply_purchase_date(input: &mut FixedBillInput) -> Result<(), String> {
    if let Some(pd) = input.purchase_date.clone() {
        let (start_month, day) = domain::purchase_installment(&pd)?;
        input.start_month = start_month;
        input.day = day;
    }
    Ok(())
}

/// Aplica data da compra (ou dia de fechamento do cartão) e recalcula o
/// end_month das parcelas a partir do start_month final. Deve rodar antes de
/// validate() e do INSERT.
fn finalize_installments(conn: &Connection, input: &mut FixedBillInput) -> Result<(), String> {
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

#[tauri::command]
pub async fn create_fixed_bill(
    state: State<'_, AppState>,
    mut input: FixedBillInput,
) -> Result<(), String> {
    with_db(&state, |c| create(c, &mut input))
}

pub fn create(conn: &Connection, input: &mut FixedBillInput) -> Result<(), String> {
    finalize_installments(conn, input)?;
    input.validate()?;
    let description = input.description.trim();
    let dup = conn
        .query_row(
            "SELECT 1 FROM fixed_bills
             WHERE description = ?1 AND amount = ?2 AND day = ?3 AND start_month = ?4
               AND payment_method_id = ?5 AND installments IS ?6
             LIMIT 1",
            params![
                description,
                input.amount,
                input.day,
                input.start_month,
                input.payment_method_id,
                input.installments
            ],
            |_| Ok(()),
        )
        .optional()
        .map_err(domain::db_err)?;
    if dup.is_some() {
        return Err("já existe conta fixa idêntica nesse mês".into());
    }
    let end_month = input.end_month.clone();
    conn.execute(
        "INSERT INTO fixed_bills (description, amount, day, category_id, payment_method_id, start_month, end_month, installments, purchase_date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
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
    .map_err(domain::db_err)?;
    domain::reconcile_fixed_bills(conn, &input.start_month, chrono::Local::now().date_naive())?;
    Ok(())
}

#[tauri::command]
pub async fn update_fixed_bill(
    state: State<'_, AppState>,
    id: i64,
    mut input: FixedBillInput,
) -> Result<(), String> {
    with_db(&state, |c| {
        finalize_installments(c, &mut input)?;
        input.validate()?;
        let affected = c
            .execute(
                "UPDATE fixed_bills SET description = ?1, amount = ?2, day = ?3, category_id = ?4,
                        payment_method_id = ?5, start_month = ?6, end_month = ?7, installments = ?8, purchase_date = ?9
                 WHERE id = ?10",
                params![
                    input.description.trim(),
                    input.amount,
                    input.day,
                    input.category_id,
                    input.payment_method_id,
                    input.start_month,
                    input.end_month,
                    input.installments,
                    input.purchase_date,
                    id
                ],
            )
            .map_err(domain::db_err)?;
        if affected == 0 {
            return Err("conta fixa não encontrada".into());
        }
        c.execute(
            "DELETE FROM transactions WHERE fixed_bill_id = ?1",
            params![id],
        )
        .map_err(domain::db_err)?;
        domain::reconcile_fixed_bills(c, &input.start_month, chrono::Local::now().date_naive())?;
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_fixed_bills(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| {
        let placeholders = vec!["?"; ids.len()].join(",");
        c.execute(
            &format!("DELETE FROM transactions WHERE fixed_bill_id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(domain::db_err)?;
        c.execute(
            &format!("DELETE FROM fixed_bills WHERE id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(domain::db_err)?;
        domain::refresh_card_bills(c)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;
    use rusqlite::Connection;

    fn test_db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        migrations().to_latest(&mut conn).unwrap();
        conn
    }

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
    fn finalize_deriva_end_month_do_mes_da_compra() {        let conn = test_db();
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
        // antes do fix: end_month ficava 2026-10 (do start_month do formulário)
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

        let rows = list(&conn, true).unwrap();

        let antigo = rows.iter().find(|b| b.description == "antigo").expect("antigo presente");
        assert!(antigo.finished, "plano encerrado deve marcar finished");
        let novo = rows.iter().find(|b| b.description == "novo").expect("novo presente");
        assert!(!novo.finished, "plano corrente não está finished");
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
