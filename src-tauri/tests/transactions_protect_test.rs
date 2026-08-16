use ajudafinancas_lib::commands::transactions::delete_ids;
use ajudafinancas_lib::db::migrations;
use rusqlite::Connection;

fn test_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    migrations().to_latest(&mut conn).unwrap();
    conn
}

fn insert_fatura(conn: &Connection) -> i64 {
    conn.execute(
        "INSERT INTO payment_methods (name, type, metadata) VALUES ('Nubank', 2, NULL)",
        [],
    )
    .unwrap();
    let pm_id = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO transactions (description, amount, type, date, payment_method_id, bill_start, bill_end)
         VALUES ('Fatura - Nubank', 5000, 3, '2026-06-20', ?1, '2026-05-10', '2026-06-10')",
        rusqlite::params![pm_id],
    )
    .unwrap();
    conn.last_insert_rowid()
}

fn insert_normal(conn: &Connection) -> i64 {
    conn.execute(
        "INSERT INTO transactions (description, amount, type, date) VALUES ('Pix', 100, 2, '2026-06-05')",
        [],
    )
    .unwrap();
    conn.last_insert_rowid()
}

#[test]
fn is_card_bill_identifica_fatura() {
    let conn = test_db();
    let f = insert_fatura(&conn);
    let n = insert_normal(&conn);
    assert!(ajudafinancas_lib::shared::card_bills::is_card_bill(&conn, f).unwrap());
    assert!(!ajudafinancas_lib::shared::card_bills::is_card_bill(&conn, n).unwrap());
}

#[test]
fn delete_ids_rejeita_fatura() {
    let conn = test_db();
    let f = insert_fatura(&conn);
    let n = insert_normal(&conn);
    delete_ids(&conn, &[n]).unwrap();
    assert!(delete_ids(&conn, &[f]).is_err());
    assert!(delete_ids(&conn, &[n, f]).is_err());
}
