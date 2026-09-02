use chrono::{Datelike, Months, NaiveDate};
use rusqlite::{params, Connection, OptionalExtension};

pub(crate) const FINISHED_GUARD_SQL: &str = "fb.installments IS NULL OR \
    ((CAST(strftime('%Y', t.date) AS INTEGER) * 12 + CAST(strftime('%m', t.date) AS INTEGER)) \
    - (CAST(substr(fb.start_month, 1, 4) AS INTEGER) * 12 + CAST(substr(fb.start_month, 6, 2) AS INTEGER))) \
    < fb.installments";

use crate::shared::settings;
use crate::shared::util::{db_err, parse_month};

pub fn last_day_of(d: NaiveDate) -> u32 {
    d.with_day(1)
        .unwrap()
        .checked_add_months(Months::new(1))
        .unwrap()
        .pred_opt()
        .unwrap()
        .day()
}

/// Período de fatura do cartão: fechamento do mês anterior até fechamento do mês de referência.
pub fn billing_period(close_day: u32, ref_month: NaiveDate) -> (NaiveDate, NaiveDate) {
    let prev = ref_month.checked_sub_months(Months::new(1)).unwrap();
    let start_day = close_day.min(last_day_of(prev));
    let end_day = close_day.min(last_day_of(ref_month));
    (
        prev.with_day(start_day).unwrap(),
        ref_month.with_day(end_day).unwrap(),
    )
}

/// Despesas a débito (cartão, card_mode = 1) no período.
pub(crate) fn card_debit_expenses(
    conn: &Connection,
    pm_id: i64,
    start: NaiveDate,
    end: NaiveDate,
) -> Result<i64, String> {
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE type = 2 AND payment_method_id = ?1 AND card_mode = 1
               AND date >= ?2 AND date < ?3",
            rusqlite::params![
                pm_id,
                start.format("%Y-%m-%d").to_string(),
                end.format("%Y-%m-%d").to_string()
            ],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(v)
}

pub(crate) fn card_close_day(ty: i64, meta: Option<&str>) -> Option<i64> {
    if ty != 2 {
        return None;
    }
    meta.and_then(|m| serde_json::from_str::<serde_json::Value>(m).ok())
        .and_then(|v| v.get("close_day")?.as_i64())
}

/// (fechamento, vencimento) do cartão, ambos > 0, ou None.
pub(crate) fn card_days(ty: i64, meta: Option<&str>) -> Option<(u32, u32)> {
    if ty != 2 {
        return None;
    }
    let v: serde_json::Value = serde_json::from_str(meta?).ok()?;
    let close = v.get("close_day")?.as_i64()?;
    let validity = v.get("validity_day")?.as_i64()?;
    if close <= 0 || validity <= 0 {
        return None;
    }
    Some((close as u32, validity as u32))
}

fn list_cards(conn: &Connection, account_id: i64) -> Result<Vec<(i64, String, u32, u32)>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, type, metadata FROM payment_methods WHERE deleted_at IS NULL AND account_id = ?1")
        .map_err(db_err)?;
    let rows = stmt
        .query_map([account_id], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, Option<String>>(3)?,
            ))
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(rows
        .into_iter()
        .filter_map(|(id, name, ty, meta)| {
            card_days(ty, meta.as_deref()).map(|(c, v)| (id, name, c, v))
        })
        .collect())
}

pub fn fatura_capable_card_ids(conn: &Connection, account_id: i64) -> Result<Vec<i64>, String> {
    Ok(list_cards(conn, account_id)?.into_iter().map(|(id, _, _, _)| id).collect())
}

/// True se a transação é uma fatura de cartão (type 3, gerada automaticamente).
pub fn is_card_bill(conn: &Connection, id: i64) -> Result<bool, String> {
    let n: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM transactions WHERE id = ?1 AND type = 3",
            params![id],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(n > 0)
}

/// Mês de fechamento da fatura paga em `payment_month`: mesmo mês se o vencimento
/// vem depois do fechamento, mês anterior caso contrário.
fn fatura_close_month(close_day: u32, validity_day: u32, payment_month: NaiveDate) -> NaiveDate {
    if validity_day > close_day {
        payment_month
    } else {
        payment_month.checked_sub_months(Months::new(1)).unwrap()
    }
}

/// Dados da fatura de um cartão paga em `payment_month`: (início, fim do período,
/// data de vencimento, total). None se o cartão não tem gastos no período.
fn card_bill(
    conn: &Connection,
    pm_id: i64,
    close_day: u32,
    validity_day: u32,
    payment_month: NaiveDate,
) -> Result<Option<(NaiveDate, NaiveDate, String, i64)>, String> {
    let close_m = fatura_close_month(close_day, validity_day, payment_month);
    let (start, end) = billing_period(close_day, close_m);
    let amount = {
        let mut stmt = conn
            .prepare(&format!(
            "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
             LEFT JOIN fixed_bills fb ON fb.id = t.fixed_bill_id AND fb.deleted_at IS NULL
             WHERE t.type = 2 AND t.payment_method_id = ?1 AND t.bill_start IS NULL
               AND t.card_mode = 0
               AND t.date >= ?2 AND t.date < ?3
               AND t.deleted_at IS NULL
               AND ({FINISHED_GUARD_SQL})"
            ))
            .map_err(db_err)?;
        stmt.query_row(
            rusqlite::params![
                pm_id,
                start.format("%Y-%m-%d").to_string(),
                end.format("%Y-%m-%d").to_string()
            ],
            |r| r.get::<_, i64>(0),
        )
        .map_err(db_err)?
    };
    if amount == 0 {
        return Ok(None);
    }
    let due_day = validity_day.min(last_day_of(payment_month));
    let due = payment_month
        .with_day(due_day)
        .unwrap()
        .format("%Y-%m-%d")
        .to_string();
    Ok(Some((start, end, due, amount)))
}

/// Gera as transações "Fatura - {nome}" dos cartões com vencimento em `payment_month`.
/// Não sobrescreve fatura já gerada (dedup por pm_id + bill_start).
pub fn ensure_card_bills(conn: &Connection, account_id: i64, payment_month: NaiveDate) -> Result<(), String> {
    for (id, name, close, validity) in list_cards(conn, account_id)? {
        let Some((start, end, due, amount)) = card_bill(conn, id, close, validity, payment_month)?
        else {
            continue;
        };
        let start_s = start.format("%Y-%m-%d").to_string();
        let desc = format!("Fatura - {name}");
        // Garante exatamente UMA fatura por (pm + bill_start):
        // 1. remove permanentemente as duplicatas do período, mantendo a de maior id;
        // 2. reativa essa única (preservando o id que o frontend usa) com dados novos;
        // 3. insere uma nova se ainda não existir nenhuma.
        let keep: Option<Option<i64>> = conn
            .query_row(
                "SELECT MAX(id) FROM transactions
                 WHERE payment_method_id = ?1 AND bill_start = ?2 AND account_id = ?3",
                rusqlite::params![id, start_s, account_id],
                |r| r.get(0),
            )
            .optional()
            .map_err(db_err)?;
        let keep_id = keep.flatten();
        if let Some(keep_id) = keep_id {
            conn.execute(
                "DELETE FROM transactions
                 WHERE payment_method_id = ?1 AND bill_start = ?2 AND account_id = ?3 AND id != ?4",
                rusqlite::params![id, start_s, account_id, keep_id],
            )
            .map_err(db_err)?;
            conn.execute(
                "UPDATE transactions
                 SET deleted_at = NULL, updated_at = datetime('now'),
                     description = ?1, amount = ?2, date = ?3, bill_end = ?4
                 WHERE id = ?5",
                rusqlite::params![
                    desc,
                    amount,
                    due,
                    end.format("%Y-%m-%d").to_string(),
                    keep_id
                ],
            )
            .map_err(db_err)?;
        } else {
            conn.execute(
                "INSERT INTO transactions (description, amount, type, date, payment_method_id, bill_start, bill_end, account_id)
                 VALUES (?1, ?2, 3, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![
                    desc,
                    amount,
                    due,
                    id,
                    start_s,
                    end.format("%Y-%m-%d").to_string(),
                    account_id
                ],
            )
            .map_err(db_err)?;
        }
    }
    Ok(())
}

/// Recalcula todas as faturas dos meses com movimento até o mês mais recente
/// de transação (ou o mês corrente, o que for maior). Faturas de meses futuros
/// contam compras a crédito já lançadas, mantendo o gráfico por forma de pagamento.
pub fn refresh_card_bills(conn: &Connection, account_id: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE transactions SET deleted_at = datetime('now'), updated_at = datetime('now')
         WHERE bill_start IS NOT NULL AND deleted_at IS NULL AND account_id = ?1",
        [account_id],
    )
    .map_err(db_err)?;
    let now = chrono::Local::now().date_naive();
    let mut m = parse_month(&settings::earliest_month(conn, account_id)?).map_err(db_err)?;
    let latest: Option<String> = conn
        .query_row(
            "SELECT MAX(date) FROM transactions WHERE deleted_at IS NULL AND account_id = ?1",
            [account_id],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    let end = latest
        .as_deref()
        .and_then(|d| d.get(..7).and_then(|m| parse_month(m).ok()))
        .map(|d| d.max(now))
        .unwrap_or(now);
    while m <= end {
        ensure_card_bills(conn, account_id, m)?;
        m = m.checked_add_months(Months::new(1)).unwrap();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::{add_pm, add_tx, test_db};
    use rusqlite::params;

    #[test]
    fn card_installment_lands_in_correct_fatura() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, category_id, payment_method_id, start_month, end_month, installments)
             VALUES ('Celular', 5000, 20, NULL, ?1, '2026-05', '2026-10', 6)",
            params![card],
        )
        .unwrap();
        crate::organizacao_financeira::service::generate_fixed_bills(&conn, 1, NaiveDate::from_ymd_opt(2026, 5, 1).unwrap()).unwrap();
        ensure_card_bills(&conn, 1, NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()).unwrap();

        let total: i64 = conn
            .query_row(
                "SELECT amount FROM transactions WHERE description = 'Fatura - Nubank' AND date = '2026-06-20'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(total, 5000);
    }

    #[test]
    fn card_bill_exclui_parcela_encerrada() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
             VALUES ('parcela', 1000, 10, ?1, '2026-01', '2026-06', 3)",
            params![card],
        )
        .unwrap();
        let fb_id = conn.last_insert_rowid();
        // linha fantasma de plano com drift: índice 6 > total 3, data dentro do período
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, fixed_bill_id, card_mode)
             VALUES ('parcela fantasma', 4000, 2, '2026-06-15', ?1, ?2, 0)",
            params![card, fb_id],
        )
        .unwrap();
        // compra crédito avulsa (sem fixed_bill) deve permanecer
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, card_mode)
             VALUES ('compra avulsa', 5000, 2, '2026-06-15', ?1, 0)",
            params![card],
        )
        .unwrap();
        // última parcela legítima (3/3, start 2026-04 → diff 2 < 3) cai no período e DEVE entrar
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
             VALUES ('parcela fim', 1000, 10, ?1, '2026-04', '2026-06', 3)",
            params![card],
        )
        .unwrap();
        let fb2 = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, fixed_bill_id, card_mode)
             VALUES ('parcela ultima', 2000, 2, '2026-06-12', ?1, ?2, 0)",
            params![card, fb2],
        )
        .unwrap();
        // primeira linha além do total (start 2026-03 → diff 3 == installments, índice 4 de 3)
        // é o ponto exato da fronteira < vs <=: DEVE ser excluída
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
             VALUES ('parcela borda', 1000, 10, ?1, '2026-03', '2026-06', 3)",
            params![card],
        )
        .unwrap();
        let fb3 = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, fixed_bill_id, card_mode)
             VALUES ('parcela borda fantasma', 3000, 2, '2026-06-15', ?1, ?2, 0)",
            params![card, fb3],
        )
        .unwrap();

        ensure_card_bills(&conn, 1, NaiveDate::from_ymd_opt(2026, 7, 1).unwrap()).unwrap();

        let amount: i64 = conn
            .query_row(
                "SELECT amount FROM transactions WHERE description = 'Fatura - Nubank'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(amount, 7000, "fantasma excluído; última parcela e avulsa mantidas");
    }

    #[test]
    fn fatura_close_month_follows_validity() {
        let jun = NaiveDate::from_ymd_opt(2026, 6, 15).unwrap();
        assert_eq!(fatura_close_month(10, 20, jun), jun);
        let prev = NaiveDate::from_ymd_opt(2026, 5, 15).unwrap();
        assert_eq!(fatura_close_month(25, 5, jun), prev);
    }

    #[test]
    fn ensures_card_bill_period_and_due() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        add_tx(&conn, "compra 1", 5000, "2026-05-15", Some(card));
        add_tx(&conn, "compra 2", 3000, "2026-06-05", Some(card));
        add_tx(&conn, "fora do período", 2000, "2026-06-15", Some(card));

        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        ensure_card_bills(&conn, 1, jun).unwrap();
        ensure_card_bills(&conn, 1, jun).unwrap();

        let (amount, date, bs, be, ty): (i64, String, String, String, i64) = conn
            .query_row(
                "SELECT amount, date, bill_start, bill_end, type FROM transactions
                 WHERE description = 'Fatura - Nubank'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
            )
            .unwrap();
        assert_eq!(amount, 8000);
        assert_eq!(date, "2026-06-20");
        assert_eq!(bs, "2026-05-10");
        assert_eq!(be, "2026-06-10");
        assert_eq!(ty, 3);

        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE description = 'Fatura - Nubank'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 1);
    }

    #[test]
    fn fatura_ignora_compra_debito() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        add_tx(&conn, "credito", 5000, "2026-05-15", Some(card));
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, card_mode)
             VALUES ('debito', 3000, 2, '2026-05-20', ?1, 1)",
            params![card],
        )
        .unwrap();

        ensure_card_bills(&conn, 1, NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()).unwrap();

        let amount: i64 = conn
            .query_row(
                "SELECT amount FROM transactions WHERE description = 'Fatura - Nubank'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(amount, 5000);

        let debit_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE description = 'debito' AND card_mode = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(debit_exists, 1);
    }

    #[test]
    fn due_in_next_month_when_validity_before_close() {
        let conn = test_db();
        let card = add_pm(&conn, "Cred", 2, Some(r#"{"close_day":25,"validity_day":5}"#));
        add_tx(&conn, "compra", 4000, "2026-04-20", Some(card));
        ensure_card_bills(&conn, 1, NaiveDate::from_ymd_opt(2026, 5, 1).unwrap()).unwrap();
        let (amount, date): (i64, String) = conn
            .query_row(
                "SELECT amount, date FROM transactions WHERE description = 'Fatura - Cred'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(amount, 4000);
        assert_eq!(date, "2026-05-05");
    }

    #[test]
    fn card_without_validity_keeps_billing_period() {
        let conn = test_db();
        let card = add_pm(&conn, "Legado", 2, Some(r#"{"close_day":10}"#));
        add_tx(&conn, "compra", 7000, "2026-05-15", Some(card));
        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        assert_eq!(crate::shared::report::month_expenses(&conn, 1, jun).unwrap(), 7000);
    }

    #[test]
    fn refresh_card_bills_gera_fatura_em_mes_futuro() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        add_tx(&conn, "credito", 5000, "2026-12-05", Some(card));
        refresh_card_bills(&conn, 1).unwrap();

        let rows: Vec<String> = conn
            .prepare("SELECT date FROM transactions WHERE description = 'Fatura - Nubank'")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(rows, vec!["2026-12-20"]);

        let dez = NaiveDate::from_ymd_opt(2026, 12, 1).unwrap();
        let rows = crate::shared::report::expenses_by_pm(&conn, 1, dez).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "Nubank");
        assert_eq!(rows[0].total, 5000);
    }

    #[test]
    fn refresh_preserva_id_da_fatura() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, card_mode)
             VALUES ('compra1', 1000, 2, '2026-06-05', ?1, 0)",
            params![card],
        )
        .unwrap();
        refresh_card_bills(&conn, 1).unwrap();
        let id: i64 = conn
            .query_row(
                "SELECT id FROM transactions WHERE description = 'Fatura - Nubank'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        // nova compra no mesmo período → refresh deve preservar o id
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, card_mode)
             VALUES ('compra2', 500, 2, '2026-06-07', ?1, 0)",
            params![card],
        )
        .unwrap();
        refresh_card_bills(&conn, 1).unwrap();
        let id2: i64 = conn
            .query_row(
                "SELECT id FROM transactions WHERE description = 'Fatura - Nubank' AND deleted_at IS NULL",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(id, id2, "fatura deve preservar o id entre refreshes");
        let amount: i64 = conn
            .query_row(
                "SELECT amount FROM transactions WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(amount, 1500);
    }

    #[test]
    fn refresh_elimina_faturas_duplicadas_do_mesmo_periodo() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        // compra no período [2026-06-10, 2026-07-10) — indica que a fatura deve existir
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, card_mode)
             VALUES ('compra', 1000, 2, '2026-06-15', ?1, 0)",
            params![card],
        )
        .unwrap();
        // simula histórico: várias linhas de fatura com o mesmo bill_start
        // (uma ativa, demais deletadas), como acumulado por refreshes antigos
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, bill_start, bill_end, account_id)
             VALUES ('Fatura - Nubank', 1000, 3, '2026-06-20', ?1, '2026-06-10', '2026-07-10', 1)",
            params![card],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, bill_start, bill_end, account_id, deleted_at)
             VALUES ('Fatura - Nubank', 1000, 3, '2026-06-20', ?1, '2026-06-10', '2026-07-10', 1, '2026-06-01 00:00:00')",
            params![card],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, bill_start, bill_end, account_id, deleted_at)
             VALUES ('Fatura - Nubank', 1000, 3, '2026-06-20', ?1, '2026-06-10', '2026-07-10', 1, '2026-06-01 00:00:00')",
            params![card],
        )
        .unwrap();

        refresh_card_bills(&conn, 1).unwrap();

        let ativas: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE payment_method_id = ?1 AND bill_start = '2026-06-10' AND deleted_at IS NULL",
                params![card],
                |r| r.get(0),
            )
            .unwrap();
        let todas: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE payment_method_id = ?1 AND bill_start = '2026-06-10'",
                params![card],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(ativas, 1, "deve restar exatamente 1 fatura ativa por período");
        assert_eq!(todas, 1, "duplicatas devem ser removidas permanentemente");
    }
}
