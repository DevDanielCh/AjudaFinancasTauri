# Modo débito/crédito em compras de cartão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir escolher débito/crédito em despesas pagas com cartão; débito é transação simples (não entra na fatura), crédito entra na fatura.

**Architecture:** Nova coluna `card_mode` em `transactions` (0=crédito, 1=débito). Faturas (`card_bill`, `get_card_bill`) filtram `card_mode = 0`; `month_expenses`/`expenses_by_pm` passam a contar débito como despesa normal; `list_transactions` passa a exibir compra débito. Frontend ganha ToggleGroup "Crédito"/"Débito" no form quando a forma selecionada é cartão.

**Tech Stack:** SQLite + rusqlite (migrações), Rust commands, Next.js/React/TypeScript.

**Contexto:** Spec em `docs/superpowers/specs/2026-08-09-cartao-debito-credito-design.md`. Testes Rust: `cd src-tauri && cargo test`. Frontend: `bun run typecheck && bun run lint && bun run build`.

---

### Task 1: Migração `card_mode`

**Files:**
- Create: `src-tauri/migrations/006_card_debit.sql`
- Modify: `src-tauri/src/db.rs:10-18`

- [ ] **Step 1: Criar a migração**

Create `src-tauri/migrations/006_card_debit.sql`:

```sql
ALTER TABLE transactions ADD COLUMN card_mode INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Registrar no runner de migrações**

In `src-tauri/src/db.rs`, add after the `005_loan_rate.sql` line:

```rust
        M::up(include_str!("../migrations/006_card_debit.sql")),
```

- [ ] **Step 3: Verificar que nada quebrou**

Run: `cd src-tauri && cargo test`
Expected: todos os testes passam (nenhum código referencia `card_mode` ainda).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/migrations/006_card_debit.sql src-tauri/src/db.rs
git commit -m "feat: migracao card_mode debito/credito"
```

---

### Task 2: `TransactionInput` ganha `card_mode` + validação

**Files:**
- Modify: `src-tauri/src/models.rs:18-27`

- [ ] **Step 1: Adicionar campo ao TransactionInput**

In `src-tauri/src/models.rs`, add the field to `TransactionInput`:

```rust
    pub date: String,
    pub category_id: Option<i64>,
    pub payment_method_id: Option<i64>,
    /// 0 = crédito, 1 = débito. Só tem efeito quando o tipo é despesa (2)
    /// e a forma de pagamento é cartão.
    #[serde(default)]
    pub card_mode: i64,
```

- [ ] **Step 2: Validar card_mode**

In the same file, in `TransactionInput::validate`, add after the payment-method check:

```rust
        if self.type_ == 2 && self.payment_method_id.is_none() {
            return Err("forma de pagamento é obrigatória para despesas".into());
        }
        if self.card_mode != 0 && self.card_mode != 1 {
            return Err("modo de cartão inválido".into());
        }
```

- [ ] **Step 3: Verificar**

Run: `cd src-tauri && cargo test`
Expected: PASS — `card_mode` tem `#[serde(default)]` e ainda não é usado; nada quebra.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/models.rs
git commit -m "feat: campo card_mode no input de transacao"
```

---

### Task 3: `card_bill` ignora débito (+ teste)

**Files:**
- Modify: `src-tauri/src/domain.rs:193-225` (card_bill), `:700-707` (test_db)
- Test: `src-tauri/src/domain.rs` (mod tests)

- [ ] **Step 1: Adicionar migração 006 ao test_db**

In `src-tauri/src/domain.rs`, mod tests, `test_db()`:

```rust
    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../migrations/001_init.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../migrations/002_card_bills.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../migrations/006_card_debit.sql"))
            .unwrap();
        conn
    }
```

- [ ] **Step 2: Escrever o teste que falha**

Add to mod tests, after `ensures_card_bill_period_and_due`:

```rust
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

        ensure_card_bills(&conn, NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()).unwrap();

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
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd src-tauri && cargo test fatura_ignora_compra_debito`
Expected: FAIL — fatura soma 8000 (crédito + débito).

- [ ] **Step 4: Implementar**

In `src-tauri/src/domain.rs`, `card_bill`, the sum query:

```sql
             WHERE type = 2 AND payment_method_id = ?1 AND bill_start IS NULL
               AND date >= ?2 AND date < ?3
```

becomes:

```sql
             WHERE type = 2 AND payment_method_id = ?1 AND bill_start IS NULL
               AND card_mode = 0
               AND date >= ?2 AND date < ?3
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd src-tauri && cargo test`
Expected: todos os testes passam (incluindo o novo).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/domain.rs
git commit -m "fix: fatura nao soma compras em modo debito"
```

---

### Task 4: `month_expenses` e `expenses_by_pm` contam débito (+ testes)

**Files:**
- Modify: `src-tauri/src/domain.rs:277-322` (month_expenses), `:353-416` (expenses_by_pm)
- Test: `src-tauri/src/domain.rs` (mod tests)

- [ ] **Step 1: Escrever testes que falham**

Add to mod tests:

```rust
    #[test]
    fn month_expenses_conta_debito_do_cartao() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        add_tx(&conn, "credito", 5000, "2026-06-05", Some(card));
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, card_mode)
             VALUES ('debito', 3000, 2, '2026-06-15', ?1, 1)",
            params![card],
        )
        .unwrap();
        ensure_card_bills(&conn, NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()).unwrap();

        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        // débito (3000) + fatura do crédito (5000)
        assert_eq!(month_expenses(&conn, jun).unwrap(), 8000);
    }

    #[test]
    fn expenses_by_pm_conta_debito_do_cartao() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        add_tx(&conn, "credito", 5000, "2026-05-15", Some(card));
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, card_mode)
             VALUES ('debito', 3000, 2, '2026-06-15', ?1, 1)",
            params![card],
        )
        .unwrap();
        ensure_card_bills(&conn, NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()).unwrap();

        let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
        let rows = expenses_by_pm(&conn, jun).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "Nubank");
        assert_eq!(rows[0].total, 8000);
    }
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src-tauri && cargo test month_expenses_conta_debito_do_cartao`
Expected: FAIL — retorna 5000 (só a fatura).

- [ ] **Step 3: Implementar month_expenses**

In `src-tauri/src/domain.rs`, `month_expenses`, replace:

```rust
    for (id, ty, meta) in pms {
        if card_days(ty, meta.as_deref()).is_some() {
            continue; // fatura substitui as compras
        }
```

with:

```rust
    for (id, ty, meta) in pms {
        if card_days(ty, meta.as_deref()).is_some() {
            // Fatura substitui o crédito; débito é despesa normal no mês civil.
            let v: i64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(amount), 0) FROM transactions
                     WHERE type = 2 AND payment_method_id = ?1 AND card_mode = 1
                       AND date >= ?2 AND date < ?3",
                    rusqlite::params![
                        id,
                        start.format("%Y-%m-%d").to_string(),
                        end.format("%Y-%m-%d").to_string()
                    ],
                    |r| r.get(0),
                )
                .map_err(db_err)?;
            total += v;
            continue;
        }
```

- [ ] **Step 4: Rodar testes de month_expenses**

Run: `cd src-tauri && cargo test month_expenses`
Expected: PASS (novo + `month_expenses_counts_bill_not_card_purchases` e `card_without_validity_keeps_billing_period` seguem verdes).

- [ ] **Step 5: Implementar expenses_by_pm**

In `src-tauri/src/domain.rs`, `expenses_by_pm`, replace:

```rust
        let t = if card_days(ty, meta.as_deref()).is_some() {
            conn.query_row(
                 "SELECT COALESCE(SUM(amount), 0) FROM transactions
                  WHERE type = 3 AND payment_method_id = ?1
                    AND date >= ?2 AND date < ?3",
                rusqlite::params![
                    id,
                    start.format("%Y-%m-%d").to_string(),
                    end.format("%Y-%m-%d").to_string()
                ],
                |r| r.get(0),
            )
            .map_err(db_err)?
        } else {
```

with:

```rust
        let t = if card_days(ty, meta.as_deref()).is_some() {
            let bill: i64 = conn
                .query_row(
                     "SELECT COALESCE(SUM(amount), 0) FROM transactions
                      WHERE type = 3 AND payment_method_id = ?1
                        AND date >= ?2 AND date < ?3",
                    rusqlite::params![
                        id,
                        start.format("%Y-%m-%d").to_string(),
                        end.format("%Y-%m-%d").to_string()
                    ],
                    |r| r.get(0),
                )
                .map_err(db_err)?;
            let debit: i64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(amount), 0) FROM transactions
                     WHERE type = 2 AND payment_method_id = ?1 AND card_mode = 1
                       AND date >= ?2 AND date < ?3",
                    rusqlite::params![
                        id,
                        start.format("%Y-%m-%d").to_string(),
                        end.format("%Y-%m-%d").to_string()
                    ],
                    |r| r.get(0),
                )
                .map_err(db_err)?;
            bill + debit
        } else {
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd src-tauri && cargo test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/domain.rs
git commit -m "feat: debito de cartao conta nas despesas do mes"
```

---

### Task 5: Commands — `TransactionRow.card_mode`, create/update/list, get_card_bill

**Files:**
- Modify: `src-tauri/src/models.rs:211-228` (TransactionRow)
- Modify: `src-tauri/src/commands/transactions.rs:15-74` (list), `:77-99` (create), `:101-134` (update), `:160-246` (get_card_bill)
- Test: `src-tauri/tests/card_debit_test.rs` (Create)

- [ ] **Step 1: Adicionar campo ao TransactionRow**

In `src-tauri/src/models.rs`, `TransactionRow`, add before `installment`:

```rust
    /// 0 = crédito, 1 = débito.
    pub card_mode: i64,
```

- [ ] **Step 2: Extrair purchases da fatura para fn testável**

In `src-tauri/src/commands/transactions.rs`, before `get_card_bill`, add:

```rust
/// Compras de crédito que compõem a fatura (card_mode = 0) no período.
pub fn card_bill_purchases(
    conn: &Connection,
    pm_id: i64,
    bill_start: &str,
    bill_end: &str,
) -> Result<Vec<TransactionRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.description, t.amount, t.type, t.date,
                    t.category_id, cat.name, t.payment_method_id, pm.name,
                    t.fixed_bill_id, t.loan_id, 0, t.card_mode,
                    fb.installments, fb.start_month
             FROM transactions t
             LEFT JOIN categories cat ON cat.id = t.category_id
             LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
             LEFT JOIN fixed_bills fb ON fb.id = t.fixed_bill_id
             WHERE t.payment_method_id = ?1 AND t.bill_start IS NULL
               AND t.card_mode = 0
               AND t.date >= ?2 AND t.date < ?3
             ORDER BY t.date ASC, t.id ASC",
        )
        .map_err(domain::db_err)?;
    let txs = stmt
        .query_map(params![pm_id, bill_start, bill_end], |r| {
            let date: String = r.get(4)?;
            let installments: Option<i64> = r.get(13)?;
            let start_month: Option<String> = r.get(14)?;
            let installment = match (installments, start_month) {
                (Some(total), Some(sm)) if total >= 1 => {
                    Some(format!("{}/{}", domain::installment_index(&sm, &date[..7]), total))
                }
                _ => None,
            };
            Ok(TransactionRow {
                id: r.get(0)?,
                description: r.get(1)?,
                amount: r.get(2)?,
                type_: r.get(3)?,
                date,
                category_id: r.get(5)?,
                category_name: r.get(6)?,
                payment_method_id: r.get(7)?,
                payment_method_name: r.get(8)?,
                fixed_bill_id: r.get(9)?,
                loan_id: r.get(10)?,
                is_card_bill: false,
                card_mode: r.get(12)?,
                installment,
            })
        })
        .map_err(domain::db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(domain::db_err)?;
    Ok(txs)
}
```

- [ ] **Step 3: Usar em get_card_bill**

Replace the body of `get_card_bill` from `let mut stmt = c` down to `let total: i64 = txs.iter().map(|t| t.amount).sum();` (the purchases query + closure + sum) with:

```rust
        let txs = card_bill_purchases(c, pm_id, &bs, &be)?;
        let total: i64 = txs.iter().map(|t| t.amount).sum();
```

- [ ] **Step 4: create_transaction grava card_mode**

In `src-tauri/src/commands/transactions.rs`, `create_transaction`:

```rust
        c.execute(
            "INSERT INTO transactions (description, amount, type, date, category_id, payment_method_id, card_mode)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                input.description.trim(),
                input.amount,
                input.type_,
                input.date,
                input.category_id,
                input.payment_method_id,
                input.card_mode
            ],
        )
```

- [ ] **Step 5: update_transaction grava card_mode**

In the same file, `update_transaction`:

```rust
            .execute(
                "UPDATE transactions SET description = ?1, amount = ?2, type = ?3, date = ?4,
                        category_id = ?5, payment_method_id = ?6, card_mode = ?7
                 WHERE id = ?8",
                params![
                    input.description.trim(),
                    input.amount,
                    input.type_,
                    input.date,
                    input.category_id,
                    input.payment_method_id,
                    input.card_mode,
                    id
                ],
            )
```

- [ ] **Step 6: list SELECT inclui card_mode e filtro mostra débito**

In the same file, `list`:

1. Add `, t.card_mode` after `(t.bill_start IS NOT NULL)` in the SELECT.
2. In the `TransactionRow` construction, add `card_mode: r.get(12)?,` before `installment: None,`.
3. Replace the filter:

```rust
    Ok(rows
        .into_iter()
        .filter(|r| {
            r.is_card_bill
                || r.payment_method_id.is_none_or(|id| !card_ids.contains(&id))
        })
        .collect())
```

with:

```rust
    Ok(rows
        .into_iter()
        .filter(|r| {
            r.is_card_bill
                || r.payment_method_id.is_none_or(|id| !card_ids.contains(&id))
                || r.card_mode == 1
        })
        .collect())
```

- [ ] **Step 7: Escrever teste de integração**

Create `src-tauri/tests/card_debit_test.rs`:

```rust
use ajudafinancas_lib::commands::transactions::card_bill_purchases;
use ajudafinancas_lib::db::migrations;
use ajudafinancas_lib::domain;
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

    domain::ensure_card_bills(&conn, domain::parse_month("2026-06").unwrap()).unwrap();

    let txs = card_bill_purchases(&conn, card, "2026-05-10", "2026-06-10").unwrap();
    assert_eq!(txs.len(), 1);
    assert_eq!(txs[0].description, "credito");
    assert_eq!(txs[0].card_mode, 0);
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `cd src-tauri && cargo test`
Expected: PASS (todos, incluindo `card_debit_test`).

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/models.rs src-tauri/src/commands/transactions.rs src-tauri/tests/card_debit_test.rs
git commit -m "feat: commands persistem card_mode e filtram fatura por credito"
```

---

### Task 6: Frontend — tipos

**Files:**
- Modify: `lib/types.ts:43-50` (TransactionInput)

- [ ] **Step 1: Adicionar card_mode ao TransactionInput**

In `lib/types.ts`, `TransactionInput`:

```ts
export interface TransactionInput {
  description: string;
  amount: number;
  type: 1 | 2;
  date: string;
  category_id: number | null;
  payment_method_id: number | null;
  card_mode: 0 | 1;
}
```

- [ ] **Step 2: Verificar**

Run: `bun run typecheck`
Expected: PASS — ainda ninguém constrói TransactionInput; `card_mode` só aparece no tipo. O campo `TransactionRow.card_mode` é adicionado na Task 8.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: tipo card_mode no input de transacao"
```

---

### Task 7: Frontend — ToggleGroup débito/crédito no form

**Files:**
- Modify: `components/forms/TransactionForm.tsx:1-79`

- [ ] **Step 1: Calcular se a forma selecionada é cartão**

Adicione antes de `return (` (o componente retorna JSX direto, sem variáveis locais hoje):

```tsx
  const selectedPm = resources.paymentMethods.find((p) => p.id === value.payment_method_id);
  const isCard = value.type === 2 && selectedPm?.type === 2;
```

- [ ] **Step 2: Renderizar o toggle**

Right after the payment-method `</Field>` block (line 63), add:

```tsx
      {isCard && (
        <Field>
          <FieldLabel>Modo</FieldLabel>
          <ToggleGroup
            value={[String(value.card_mode)]}
            onValueChange={(v) => onChange({ ...value, card_mode: v[0] === "1" ? 1 : 0 })}
          >
            <ToggleGroupItem value="0">Crédito</ToggleGroupItem>
            <ToggleGroupItem value="1">Débito</ToggleGroupItem>
          </ToggleGroup>
        </Field>
      )}
```

- [ ] **Step 3: Verificar**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/forms/TransactionForm.tsx
git commit -m "feat: form de despesa com cartao escolhe debito/credito"
```

---

### Task 8: Frontend — `TransactionRow.card_mode` + página preenche o form

**Files:**
- Modify: `lib/types.ts:16-30` (TransactionRow)
- Modify: `app/transactions/page.tsx:58-66`

- [ ] **Step 1: Adicionar card_mode ao TransactionRow**

In `lib/types.ts`, `TransactionRow`, add before `installment`:

```ts
  card_mode: 0 | 1;
```

- [ ] **Step 2: empty() e toInput()**

In `app/transactions/page.tsx`:

```tsx
          empty: (): TransactionInput => ({
            description: "", amount: 0, type: 2, date: new Date().toISOString().slice(0, 10),
            category_id: null, payment_method_id: null, card_mode: 0,
          }),
          toInput: (r): TransactionInput => ({
            description: r.description, amount: r.amount,
            type: r.type === 3 ? 2 : r.type, date: r.date,
            category_id: r.category_id, payment_method_id: r.payment_method_id,
            card_mode: r.card_mode,
          }),
```

- [ ] **Step 3: Verificar**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts app/transactions/page.tsx
git commit -m "feat: transacoes preenchem card_mode no form"
```

---

### Task 9: Verificação completa

**Files:** nenhum

- [ ] **Step 1: Rodar tudo**

Run: `cd src-tauri && cargo test && cd .. && bun run typecheck && bun run lint && bun run build`
Expected: tudo verde.

- [ ] **Step 2: Teste manual**

1. `bun tauri android build --apk --target armv7` (ver AGENTS.md p/ sign + install).
2. No app: cadastrar despesa com cartão → escolher **Débito** → salvar.
3. Conferir que a transação aparece na listagem de transações e não aparece na fatura do cartão.
4. Cadastrar despesa com cartão **Crédito** → confirmar que SOME da listagem e aparece na fatura.
