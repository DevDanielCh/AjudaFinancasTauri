use ajudafinancas_lib::db::migrations;
use ajudafinancas_lib::domain;
use chrono::NaiveDate;
use rusqlite::Connection;

fn conn() -> Connection {
    let mut c = Connection::open_in_memory().unwrap();
    migrations().to_latest(&mut c).unwrap();
    c
}

fn add_pm(c: &Connection, name: &str) -> i64 {
    c.execute(
        "INSERT INTO payment_methods (name, type, metadata) VALUES (?1, 1, NULL)",
        [name],
    )
    .unwrap();
    c.last_insert_rowid()
}

fn add_tx(c: &Connection, desc: &str, amount: i64, ty: i64, date: &str, pm_id: Option<i64>) {
    c.execute(
        "INSERT INTO transactions (description, amount, type, date, payment_method_id)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![desc, amount, ty, date, pm_id],
    )
    .unwrap();
}

#[test]
fn monthly_series_acumula_saldo_desde_zero() {
    let c = conn();
    let pix = add_pm(&c, "PIX");
    add_tx(&c, "salario", 100000, 1, "2026-04-05", None);
    add_tx(&c, "mercado", 40000, 2, "2026-04-10", Some(pix));
    add_tx(&c, "freela", 50000, 1, "2026-05-05", None);
    add_tx(&c, "contas", 30000, 2, "2026-05-10", Some(pix));

    let series = domain::monthly_series(&c, NaiveDate::from_ymd_opt(2026, 5, 1).unwrap(), 3).unwrap();
    assert_eq!(series.len(), 3);
    assert_eq!(series[0].month, "2026-03");
    assert_eq!(series[0].income, 0);
    assert_eq!(series[0].expenses, 0);
    assert_eq!(series[0].balance, 0);
    assert_eq!(series[1].month, "2026-04");
    assert_eq!(series[1].income, 100000);
    assert_eq!(series[1].expenses, 40000);
    assert_eq!(series[1].balance, 60000);
    assert_eq!(series[2].month, "2026-05");
    assert_eq!(series[2].balance, 80000);
}

#[test]
fn expenses_by_category_agrupa_e_ignora_receitas() {
    let c = conn();
    let pix = add_pm(&c, "PIX");
    c.execute(
        "INSERT INTO categories (name, type, color) VALUES ('Alimentação', 2, '#ef4444')",
        [],
    )
    .unwrap();
    let cat = c.last_insert_rowid();
    add_tx(&c, "mercado", 5000, 2, "2026-06-03", Some(pix));
    add_tx(&c, "lanche", 3000, 1, "2026-06-05", None);
    c.execute(
        "INSERT INTO transactions (description, amount, type, date, category_id)
         VALUES ('uber', 2000, 2, '2026-06-06', ?1)",
        [cat],
    )
    .unwrap();
    add_tx(&c, "avulsa", 3000, 2, "2026-06-07", Some(pix));

    let rows = domain::expenses_by_category(
        &c,
        NaiveDate::from_ymd_opt(2026, 6, 1).unwrap(),
        NaiveDate::from_ymd_opt(2026, 7, 1).unwrap(),
    )
    .unwrap();
    let totais: std::collections::HashMap<_, _> = rows.iter().map(|r| (r.name.as_str(), r.total)).collect();
    assert_eq!(totais.get("Alimentação"), Some(&2000));
    assert_eq!(totais.get("Sem categoria"), Some(&8000));
    assert_eq!(totais.len(), 2);
}
