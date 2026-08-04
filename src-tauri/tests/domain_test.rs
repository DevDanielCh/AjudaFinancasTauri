use ajudafinancas_lib::domain::{billing_period, month_range};
use chrono::NaiveDate;

#[test]
fn billing_period_respeita_fechamento_e_clamp() {
    let ref_month = NaiveDate::from_ymd_opt(2026, 3, 1).unwrap();
    let (s, e) = billing_period(10, ref_month);
    assert_eq!(s, NaiveDate::from_ymd_opt(2026, 2, 10).unwrap());
    assert_eq!(e, NaiveDate::from_ymd_opt(2026, 3, 10).unwrap());

    // dia 31 clampado: fev só tem 28, abr 30
    let (s2, e2) = billing_period(31, NaiveDate::from_ymd_opt(2026, 4, 1).unwrap());
    assert_eq!(s2, NaiveDate::from_ymd_opt(2026, 3, 31).unwrap());
    assert_eq!(e2, NaiveDate::from_ymd_opt(2026, 4, 30).unwrap());
}

#[test]
fn month_range_gera_inicio_e_fim() {
    let (s, e) = month_range("2026-01").unwrap();
    assert_eq!(s, NaiveDate::from_ymd_opt(2026, 1, 1).unwrap());
    assert_eq!(e, NaiveDate::from_ymd_opt(2026, 2, 1).unwrap());
    assert!(month_range("abc").is_err());
}
