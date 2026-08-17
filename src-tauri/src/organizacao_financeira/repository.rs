use crate::organizacao_financeira::models::{Category, FixedBill, PaymentMethod};
use crate::shared::util::{current_month, db_err, order_clause};
use rusqlite::Connection;

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
