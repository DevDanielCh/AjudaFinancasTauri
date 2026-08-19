pub mod card_bills;
pub mod report;
pub mod settings;
pub mod util;

#[cfg(test)]
pub(crate) fn test_db() -> rusqlite::Connection {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(include_str!("../../migrations/001_init.sql"))
        .unwrap();
    conn.execute_batch(include_str!("../../migrations/002_card_bills.sql"))
        .unwrap();
    conn.execute_batch(include_str!("../../migrations/006_card_debit.sql"))
        .unwrap();
    conn.execute_batch(include_str!("../../migrations/008_settings.sql"))
        .unwrap();
    conn.execute_batch(include_str!("../../migrations/009_sync.sql"))
        .unwrap();
    conn
}

#[cfg(test)]
pub(crate) fn add_pm(conn: &rusqlite::Connection, name: &str, ty: i64, meta: Option<&str>) -> i64 {
    conn.execute(
        "INSERT INTO payment_methods (name, type, metadata) VALUES (?1, ?2, ?3)",
        rusqlite::params![name, ty, meta],
    )
    .unwrap();
    conn.last_insert_rowid()
}

#[cfg(test)]
pub(crate) fn add_tx(
    conn: &rusqlite::Connection,
    desc: &str,
    amount: i64,
    date: &str,
    pm_id: Option<i64>,
) {
    conn.execute(
        "INSERT INTO transactions (description, amount, type, date, payment_method_id)
         VALUES (?1, ?2, 2, ?3, ?4)",
        rusqlite::params![desc, amount, date, pm_id],
    )
    .unwrap();
}
