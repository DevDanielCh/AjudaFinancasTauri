use ajudafinancas_lib::db::migrations;
use rusqlite::Connection;

#[test]
fn migrations_criam_tabelas_e_seed() {
    let mut conn = Connection::open_in_memory().unwrap();
    migrations().to_latest(&mut conn).unwrap();
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM payment_methods", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 2, "seed deve inserir PIX e Boleto");
}
