use ajudafinancas_lib::shared::report;
use ajudafinancas_lib::shared::settings::{self, SettingsInput};
use chrono::NaiveDate;
use rusqlite::Connection;

fn test_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    ajudafinancas_lib::db::migrations().to_latest(&mut conn).unwrap();
    conn
}

fn set(conn: &Connection, primeiro_mes: Option<&str>, conta: i64, reserva: i64) {
    settings::set_settings(
        conn,
        &SettingsInput {
            primeiro_mes: primeiro_mes.map(String::from),
            saldo_inicial_conta: conta,
            saldo_inicial_reserva: reserva,
            meta_investimento: 0.0,
        },
    )
    .unwrap();
}

#[test]
fn get_settings_default_quando_vazio() {
    let conn = test_db();
    let s = settings::get_settings_impl(&conn).unwrap();
    assert_eq!(s.primeiro_mes, None);
    assert_eq!(s.saldo_inicial_conta, 0);
    assert_eq!(s.saldo_inicial_reserva, 0);
}

#[test]
fn earliest_month_respeita_primeiro_mes() {
    let conn = test_db();
    conn.execute("INSERT INTO transactions (description, amount, type, date) VALUES ('x', 1, 2, '2025-01-10')", [])
        .unwrap();
    assert_eq!(settings::earliest_month(&conn).unwrap(), "2025-01");
    set(&conn, Some("2026-03"), 0, 0);
    assert_eq!(settings::earliest_month(&conn).unwrap(), "2026-03", "config sobrescreve transação antiga");
}

#[test]
fn reserva_balance_soma_saldo_inicial_e_ignora_antes_do_piso() {
    let conn = test_db();
    conn.execute_batch(
        "INSERT INTO transactions (description, amount, type, date) VALUES
         ('antigo', 50000, 4, '2026-01-05'),
         ('aporte', 100000, 4, '2026-06-10'),
         ('resgate', 30000, 5, '2026-06-15')",
    )
    .unwrap();
    set(&conn, Some("2026-06"), 0, 20000);
    let jul = NaiveDate::from_ymd_opt(2026, 7, 1).unwrap();
    assert_eq!(
        ajudafinancas_lib::investimentos::repository::reserva_balance_at(&conn, jul).unwrap(),
        90000,
        "saldo inicial 20000 + aporte 100000 - resgate 30000; aporte antigo ignorado"
    );
}

#[test]
fn account_balance_at_soma_fluxos_do_piso() {
    let conn = test_db();
    conn.execute_batch(
        "INSERT INTO transactions (description, amount, type, date) VALUES
         ('receita', 5000, 1, '2026-01-10'),
         ('despesa', 2000, 2, '2026-02-10'),
         ('aporte', 1000, 4, '2026-02-15')",
    )
    .unwrap();
    set(&conn, Some("2026-02"), 10000, 0);
    let mar = NaiveDate::from_ymd_opt(2026, 3, 1).unwrap();
    assert_eq!(
        report::account_balance_at(&conn, mar).unwrap(),
        7000,
        "saldo 10000 + (0 - despesa 2000 - aporte 1000); receita de janeiro ignorada"
    );
}

#[test]
fn monthly_series_mostra_ano_inteiro_e_usa_posicao_com_piso() {
    let conn = test_db();
    conn.execute(
        "INSERT INTO transactions (description, amount, type, date) VALUES ('aporte', 50000, 4, '2026-06-10')",
        [],
    )
    .unwrap();
    set(&conn, Some("2026-06"), 0, 10000);
    let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
    let pts = report::monthly_series(&conn, jun).unwrap();
    assert_eq!(pts.len(), 12, "ano inteiro mesmo com piso");
    assert_eq!(pts[0].month, "2026-01");
    assert_eq!(pts[0].reserva, 10000, "antes do piso: só o saldo inicial");
    let jun_pt = pts.iter().find(|p| p.month == "2026-06").unwrap();
    assert_eq!(jun_pt.reserva, 60000, "saldo inicial reserva 10000 + aporte 50000");
}

#[test]
fn monthly_series_sem_config_mostra_ano_inteiro() {
    let conn = test_db();
    let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
    let pts = report::monthly_series(&conn, jun).unwrap();
    assert_eq!(pts.len(), 12);
    assert_eq!(pts[0].month, "2026-01");
    assert_eq!(pts[11].month, "2026-12");
}

#[test]
fn update_settings_valida() {
    assert!(SettingsInput {
        primeiro_mes: Some("garbage".into()),
        saldo_inicial_conta: 0,
        saldo_inicial_reserva: 0,
        meta_investimento: 0.0,
    }
    .validate()
    .is_err());
    assert!(SettingsInput {
        primeiro_mes: Some("2099-01".into()),
        saldo_inicial_conta: 0,
        saldo_inicial_reserva: 0,
        meta_investimento: 0.0,
    }
    .validate()
    .is_err());
    assert!(SettingsInput {
        primeiro_mes: None,
        saldo_inicial_conta: -1,
        saldo_inicial_reserva: 0,
        meta_investimento: 0.0,
    }
    .validate()
    .is_err());
    assert!(SettingsInput {
        primeiro_mes: None,
        saldo_inicial_conta: 0,
        saldo_inicial_reserva: 10,
        meta_investimento: 0.0,
    }
    .validate()
    .is_ok());
}
