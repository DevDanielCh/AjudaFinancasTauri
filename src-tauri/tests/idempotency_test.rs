use ajudafinancas_lib::commands::categories;
use ajudafinancas_lib::commands::fixed_bills;
use ajudafinancas_lib::commands::loans;
use ajudafinancas_lib::commands::payment_methods;
use ajudafinancas_lib::commands::transactions;
use ajudafinancas_lib::db::migrations;
use ajudafinancas_lib::models::{
    CategoryInput, FixedBillInput, LoanInput, PaymentMethodInput, TransactionInput,
};
use rusqlite::Connection;

fn test_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    migrations().to_latest(&mut conn).unwrap();
    conn
}

#[test]
fn create_categoria_duplicada_rejeita() {
    let conn = test_db();
    let input = CategoryInput {
        name: "Alimentação".into(),
        type_: 2,
        color: "#f00".into(),
        icon: None,
    };
    categories::create(&conn, &input).unwrap();
    let err = categories::create(&conn, &input).unwrap_err();
    assert!(err.contains("já existe"));
    let err = categories::create(&conn, &CategoryInput { type_: 1, ..input.clone() }).unwrap_err();
    assert!(err.contains("já existe"), "nome repetido em outro tipo também bloqueia");
}

#[test]
fn create_forma_pagamento_duplicada_rejeita() {
    let conn = test_db();
    let input = PaymentMethodInput {
        name: "Nubank".into(),
        type_: 2,
        close_day: Some(10),
        validity_day: Some(20),
    };
    payment_methods::create(&conn, &input).unwrap();
    let err = payment_methods::create(&conn, &input).unwrap_err();
    assert!(err.contains("já existe"));
}

#[test]
fn create_transacao_duplicada_rejeita_mas_difere_por_dia() {
    let conn = test_db();
    let base = TransactionInput {
        description: "Almoço".into(),
        amount: 5000,
        type_: 2,
        date: "2026-06-05".into(),
        category_id: None,
        payment_method_id: None,
        card_mode: 0,
    };
    transactions::create(&conn, &base).unwrap();
    let err = transactions::create(&conn, &base).unwrap_err();
    assert!(err.contains("já existe"));
    transactions::create(
        &conn,
        &TransactionInput { date: "2026-06-06".into(), ..base },
    )
    .unwrap();
    assert_eq!(
        conn.query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        2,
        "transações iguais em dias diferentes são válidas"
    );
}

#[test]
fn transacao_gerada_por_conta_fixa_nao_vira_falso_duplicado() {
    let conn = test_db();
    conn.execute("INSERT INTO payment_methods (name, type) VALUES ('PIX', 1)", [])
        .unwrap();
    let pm_id = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month)
         VALUES ('Internet', 10000, 5, ?1, '2026-06')",
        rusqlite::params![pm_id],
    )
    .unwrap();
    let fb_id = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO transactions (description, amount, type, date, fixed_bill_id)
         VALUES ('Internet', 10000, 2, '2026-06-05', ?1)",
        rusqlite::params![fb_id],
    )
    .unwrap();
    let input = TransactionInput {
        description: "Internet".into(),
        amount: 10000,
        type_: 2,
        date: "2026-06-05".into(),
        category_id: None,
        payment_method_id: None,
        card_mode: 0,
    };
    transactions::create(&conn, &input).unwrap();
    assert_eq!(
        conn.query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        2,
        "transação manual idêntica à gerada deve passar"
    );
}

#[test]
fn create_conta_fixa_duplicada_rejeita() {
    let conn = test_db();
    conn.execute("INSERT INTO payment_methods (name, type) VALUES ('PIX', 1)", [])
        .unwrap();
    let pm_id = conn.last_insert_rowid();
    let mut input = FixedBillInput {
        description: "Internet".into(),
        amount: 10000,
        day: 5,
        category_id: None,
        payment_method_id: pm_id,
        start_month: "2026-06".into(),
        end_month: None,
        installments: None,
        purchase_date: None,
    };
    fixed_bills::create(&conn, &mut input.clone()).unwrap();
    let err = fixed_bills::create(&conn, &mut input).unwrap_err();
    assert!(err.contains("já existe"));
}

#[test]
fn create_emprestimo_duplicado_rejeita() {
    let conn = test_db();
    conn.execute("INSERT INTO payment_methods (name, type) VALUES ('Caixa', 1)", [])
        .unwrap();
    let pm_id = conn.last_insert_rowid();
    let input = LoanInput {
        type_: 2,
        description: "Carro".into(),
        principal: 100000,
        installment: 10000,
        total_installments: 12,
        day: 10,
        start_month: "2026-06".into(),
        payment_method_id: pm_id,
        monthly_rate: 0.0,
    };
    loans::create(&conn, &input).unwrap();
    let err = loans::create(&conn, &input).unwrap_err();
    assert!(err.contains("já existe"));
}
