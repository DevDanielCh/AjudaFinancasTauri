use ajudafinancas_lib::models::{FixedBillInput, LoanInput, TransactionInput};

#[test]
fn valida_transacao() {
    let t = TransactionInput {
        description: "".into(),
        amount: 100,
        type_: 2,
        date: "2026-01-10".into(),
        category_id: None,
        payment_method_id: None,
    };
    assert!(t.validate().is_err(), "descrição vazia deve falhar");

    let mut t2 = t.clone();
    t2.description = "Conta".into();
    assert!(t2.validate().is_err(), "despesa sem forma de pagamento deve falhar");

    t2.payment_method_id = Some(1);
    assert!(t2.validate().is_ok());
}

#[test]
fn valida_conta_fixa() {
    let b = FixedBillInput {
        description: "Aluguel".into(),
        amount: 100_000,
        day: 5,
        category_id: None,
        payment_method_id: 1,
        start_month: "2026-01".into(),
        end_month: None,
        installments: None,
    };
    assert!(b.validate().is_ok());

    let mut b2 = b.clone();
    b2.installments = Some(1);
    assert!(b2.validate().is_err(), "parcelas < 2 deve falhar");

    b2.installments = Some(3);
    assert!(b2.validate().is_ok(), "parcelas >= 2 define end_month");

    let mut b3 = b.clone();
    b3.end_month = Some("2025-12".into());
    assert!(b3.validate().is_err(), "fim antes do início deve falhar");
}

#[test]
fn valida_emprestimo() {
    let l = LoanInput {
        type_: 1,
        description: "Empréstimo".into(),
        principal: 100_000,
        installment: 35_000,
        total_installments: 3,
        day: 10,
        start_month: "2026-01".into(),
        payment_method_id: 1,
    };
    assert!(l.validate().is_ok());

    let mut l2 = l.clone();
    l2.total_installments = 1;
    assert!(l2.validate().is_err(), "parcelas < 2 deve falhar");

    let mut l3 = l.clone();
    l3.installment = 20_000; // total 60k < 100k principal
    assert!(l3.validate().is_err(), "total menor que principal deve falhar");
}
