use crate::organizacao_financeira::models::{Category, PaymentMethod};
use crate::shared::util::{db_err, order_clause};
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
