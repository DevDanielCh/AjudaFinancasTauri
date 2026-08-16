use ajudafinancas_lib::commands::transactions::card_bill_purchases;
use ajudafinancas_lib::db::migrations;
use rusqlite::Connection;

fn test_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    migrations().to_latest(&mut conn).unwrap();
    conn
}

#[test]
fn fatura_detail_ignora_compra_debito() {
    let conn = test_db();
    conn.execute(
        "INSERT INTO payment_methods (name, type, metadata)
         VALUES ('Nubank', 2, '{\"close_day\":10,\"validity_day\":20}')",
        [],
    )
    .unwrap();
    let card = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO transactions (description, amount, type, date, payment_method_id)
         VALUES ('credito', 5000, 2, '2026-05-15', ?1)",
        rusqlite::params![card],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO transactions (description, amount, type, date, payment_method_id, card_mode)
         VALUES ('debito', 3000, 2, '2026-05-20', ?1, 1)",
        rusqlite::params![card],
    )
    .unwrap();

    ajudafinancas_lib::shared::card_bills::ensure_card_bills(
        &conn,
        ajudafinancas_lib::shared::util::parse_month("2026-06").unwrap(),
    )
    .unwrap();

    let txs = card_bill_purchases(&conn, card, "2026-05-10", "2026-06-10").unwrap();
    assert_eq!(txs.len(), 1);
    assert_eq!(txs[0].description, "credito");
    assert_eq!(txs[0].card_mode, 0);
}
