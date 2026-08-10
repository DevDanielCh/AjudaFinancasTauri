# Parcelamento Encerrado: apagado na lista e fora da fatura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parcelamentos que passaram do total de parcelas ficam `finished` (apagados na lista) e param de entrar na fatura do cartão; planos novos não geram mais parcela além do total.

**Architecture:** Regra única em Rust (`domain::installment_finished`: índice da parcela > total). A fatura (SUM de geração + detalhe) ganha guard SQL compartilhado `FINISHED_GUARD_SQL` excluindo linhas além do total; `generate_fixed_bills` clampa a geração; `create/update_fixed_bill` recalculam `end_month` depois de aplicar a data da compra. Frontend: `CrudConfig.rowClass` genérico + `FixedBill.finished`.

**Tech Stack:** Rust (rusqlite), Tauri, React/TS, shadcn (cn).

**Repo conventions:** commits direto na master; UI pt-BR; mensagens de commit `feat:`/`fix:`/`test:`/`refactor:`; testes Rust com `test_db()` (in-memory). Não commitar `src-tauri/gen/`.

---

### Task 1: helper `installment_finished` + `FINISHED_GUARD_SQL`

**Files:**
- Modify: `src-tauri/src/domain.rs:23-25` (após `installment_index`)
- Test: `src-tauri/src/domain.rs` mod tests (~linha 759)

- [ ] **Step 1: Escrever teste que falha** (helper ainda não existe)

Em `src-tauri/src/domain.rs`, dentro de `mod tests` (após o primeiro teste `#[test]`), adicionar:

```rust
    #[test]
    fn installment_finished_edges() {
        assert!(!installment_finished("2026-01", 3, "2026-01")); // 1/3
        assert!(!installment_finished("2026-01", 3, "2026-03")); // 3/3, último
        assert!(installment_finished("2026-01", 3, "2026-04")); // 4/3, passou
        assert!(!installment_finished("2026-01", 3, "2025-12")); // antes do início → index 1
        assert!(!installment_finished("2026-01", 0, "2026-04")); // total inválido
    }
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src-tauri && cargo test installment_finished_edges`
Expected: FAIL — `cannot find function installment_finished`.

- [ ] **Step 3: Implementar helper + const**

Em `src-tauri/src/domain.rs`, logo após `installment_index` (linha 25), adicionar:

```rust
/// Verdadeiro quando a parcela de `row_month` ultrapassa o total (parcelamento encerrado).
pub fn installment_finished(start_month: &str, installments: i64, row_month: &str) -> bool {
    installments >= 1 && installment_index(start_month, row_month) > installments
}

/// Fragmento SQL que exclui parcelas além do total em consultas de fatura.
/// Espera aliases `t` (transactions) e `fb` (fixed_bills LEFT JOIN).
pub const FINISHED_GUARD_SQL: &str = "fb.installments IS NULL OR \
((CAST(strftime('%Y', t.date) AS INTEGER) * 12 + CAST(strftime('%m', t.date) AS INTEGER)) \
- (CAST(substr(fb.start_month, 1, 4) AS INTEGER) * 12 + CAST(substr(fb.start_month, 6, 2) AS INTEGER))) \
< fb.installments";
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src-tauri && cargo test installment_finished_edges`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/domain.rs
git commit -m "feat: helper installment_finished e guard sql de fatura"
```

---

### Task 2: raiz — `end_month` após data da compra (create/update)

**Files:**
- Modify: `src-tauri/src/commands/fixed_bills.rs:90-125` (create), `:127-173` (update)
- Test: `src-tauri/src/commands/fixed_bills.rs` (novo `mod tests`)

- [ ] **Step 1: Escrever teste que falha**

No fim de `src-tauri/src/commands/fixed_bills.rs`, adicionar:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;
    use rusqlite::Connection;

    fn test_db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        migrations().to_latest(&mut conn).unwrap();
        conn
    }

    fn base_input() -> FixedBillInput {
        FixedBillInput {
            description: "compra".into(),
            amount: 1000,
            day: 1,
            category_id: None,
            payment_method_id: 0,
            start_month: "2026-08".into(),
            end_month: None,
            installments: Some(3),
            purchase_date: None,
        }
    }

    #[test]
    fn finalize_deriva_end_month_do_mes_da_compra() {
        let conn = test_db();
        let card = conn
            .execute(
                "INSERT INTO payment_methods (name, type, metadata) VALUES ('Nubank', 2, NULL)",
                [],
            )
            .unwrap();
        let card_id = conn.last_insert_rowid();
        let mut input = base_input();
        input.payment_method_id = card_id;
        input.purchase_date = Some("2026-05-20".into());

        finalize_installments(&conn, &mut input).unwrap();

        assert_eq!(input.start_month, "2026-05");
        assert_eq!(input.day, 20);
        // antes do fix: end_month ficava 2026-10 (do start_month do formulário)
        assert_eq!(input.end_month.as_deref(), Some("2026-07"));
    }
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src-tauri && cargo test finalize_deriva_end_month_do_mes_da_compra`
Expected: FAIL — `cannot find function finalize_installments`.

- [ ] **Step 3: Extrair `finalize_installments` e reordenar create/update**

Em `src-tauri/src/commands/fixed_bills.rs`, após `apply_purchase_date` (linha 88), adicionar:

```rust
/// Aplica data da compra (ou dia de fechamento do cartão) e recalcula o
/// end_month das parcelas a partir do start_month final. Deve rodar antes de
/// validate() e do INSERT.
fn finalize_installments(conn: &Connection, input: &mut FixedBillInput) -> Result<(), String> {
    if input.purchase_date.is_some() {
        apply_purchase_date(input)?;
    } else {
        apply_card_day(conn, input)?;
    }
    if input.installments.is_some() {
        *input = input.normalized()?;
    }
    Ok(())
}
```

Em `create_fixed_bill` (linhas 95-98), trocar:

```rust
    if input.installments.is_some() {
        input = input.normalized()?;
    }
    input.validate()?;
    with_db(&state, |c| {
        if input.purchase_date.is_some() {
            apply_purchase_date(&mut input)?;
        } else {
            apply_card_day(c, &mut input)?;
        }
        let end_month = input.end_month.clone();
```

por:

```rust
    with_db(&state, |c| {
        finalize_installments(c, &mut input)?;
        input.validate()?;
        let end_month = input.end_month.clone();
```

Em `update_fixed_bill` (linhas 133-137), trocar:

```rust
    if input.installments.is_some() {
        input = input.normalized()?;
    }
    input.validate()?;
    with_db(&state, |c| {
        if input.purchase_date.is_some() {
            apply_purchase_date(&mut input)?;
        } else {
            apply_card_day(c, &mut input)?;
        }
        let affected = c
```

por:

```rust
    with_db(&state, |c| {
        finalize_installments(c, &mut input)?;
        input.validate()?;
        let affected = c
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src-tauri && cargo test finalize_deriva_end_month_do_mes_da_compra`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte completa**

Run: `cd src-tauri && cargo test`
Expected: PASS (todos os testes).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/fixed_bills.rs
git commit -m "fix: end_month das parcelas deriva do mes da compra"
```

---

### Task 3: `generate_fixed_bills` não gera além do total

**Files:**
- Modify: `src-tauri/src/domain.rs:449-505` (generate_fixed_bills)
- Test: `src-tauri/src/domain.rs` mod tests

- [ ] **Step 1: Escrever teste que falha**

Em `src-tauri/src/domain.rs` mod tests, adicionar:

```rust
    #[test]
    fn generate_stops_at_installments_count() {
        let conn = test_db();
        let pm = add_pm(&conn, "PIX", 1, None);
        // plano com end_month largo (drift de dados antigo): start 2026-01, 3 parcelas, end 2026-06
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
             VALUES ('parcela', 1000, 10, ?1, '2026-01', '2026-06', 3)",
            params![pm],
        )
        .unwrap();

        generate_fixed_bills(&conn, NaiveDate::from_ymd_opt(2026, 3, 1).unwrap()).unwrap();
        generate_fixed_bills(&conn, NaiveDate::from_ymd_opt(2026, 4, 1).unwrap()).unwrap();

        let rows: i64 = conn
            .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
            .unwrap();
        assert_eq!(rows, 2, "março (3/3) e abril (4/3) geram; maio/junho param");
    }
```

Note: março (diff 2 < 3) e abril (diff 3 >= 3 → pula). Esperado 2 linhas. O commit da Task 3 usa `month_diff` já existente em domain.rs.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src-tauri && cargo test generate_stops_at_installments_count`
Expected: FAIL — gera 3+ linhas (abril entraria porque `end_month=2026-06 >= 2026-04`).

- [ ] **Step 3: Implementar clamp**

Em `generate_fixed_bills` (domain.rs:451-471), trocar o SELECT e o mapping:

```rust
    let mut stmt = conn
        .prepare(
            "SELECT id, description, amount, day, category_id, payment_method_id, installments, start_month
             FROM fixed_bills
             WHERE start_month <= ?1 AND (end_month IS NULL OR end_month >= ?1)",
        )
        .map_err(db_err)?;
    let bills = stmt
        .query_map(rusqlite::params![month_key], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, Option<i64>>(4)?,
                r.get::<_, i64>(5)?,
                r.get::<_, Option<i64>>(6)?,
                r.get::<_, String>(7)?,
            ))
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
```

E no loop (linha 481), antes do `let exists`, adicionar o guard:

```rust
    for (id, description, amount, day, category_id, payment_method_id, installments, start_month) in bills {
        if let Some(n) = installments {
            if month_diff(&start_month, &month_key) >= n {
                continue; // parcela além do total: plano encerrado
            }
        }
        let exists: i64 = conn
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src-tauri && cargo test generate_stops_at_installments_count`
Expected: PASS.

- [ ] **Step 5: Suíte completa + commit**

Run: `cd src-tauri && cargo test`

```bash
git add src-tauri/src/domain.rs
git commit -m "fix: geracao de parcelas para no total informado"
```

---

### Task 4: `card_bill` (SUM da fatura) exclui parcela além do total

**Files:**
- Modify: `src-tauri/src/domain.rs:225-238` (card_bill)
- Test: `src-tauri/src/domain.rs` mod tests

- [ ] **Step 1: Escrever teste que falha**

Em `src-tauri/src/domain.rs` mod tests, adicionar:

```rust
    #[test]
    fn card_bill_exclui_parcela_encerrada() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        let fb_id = conn
            .execute(
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

        ensure_card_bills(&conn, NaiveDate::from_ymd_opt(2026, 7, 1).unwrap()).unwrap();

        let amount: i64 = conn
            .query_row(
                "SELECT amount FROM transactions WHERE description = 'Fatura - Nubank'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(amount, 5000, "fantasma excluído, avulsa mantida");
    }
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src-tauri && cargo test card_bill_exclui_parcela_encerrada`
Expected: FAIL — amount == 9000 (fantasma incluído).

- [ ] **Step 3: Implementar guard no SUM**

Em `card_bill` (domain.rs:225-238), trocar a query por:

```rust
    let amount = {
        let mut stmt = conn
            .prepare(&format!(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions t
                 LEFT JOIN fixed_bills fb ON fb.id = t.fixed_bill_id
                 WHERE t.type = 2 AND t.payment_method_id = ?1 AND t.bill_start IS NULL
                   AND t.card_mode = 0
                   AND t.date >= ?2 AND t.date < ?3
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src-tauri && cargo test card_bill_exclui_parcela_encerrada`
Expected: PASS.

- [ ] **Step 5: Suíte completa + commit**

Run: `cd src-tauri && cargo test`

```bash
git add src-tauri/src/domain.rs
git commit -m "fix: fatura nao soma parcela alem do total"
```

---

### Task 5: `card_bill_purchases` (detalhe) exclui parcela além do total

**Files:**
- Modify: `src-tauri/src/commands/transactions.rs:174-188` (card_bill_purchases)
- Test: `src-tauri/src/commands/transactions.rs:268-334` mod tests

- [ ] **Step 1: Escrever teste que falha**

Em `src-tauri/src/commands/transactions.rs` mod tests, adicionar:

```rust
    #[test]
    fn fatura_detalhe_exclui_parcela_encerrada() {
        let conn = test_db();
        let card = add_pm(&conn, "Nubank", 2, Some(r#"{"close_day":10,"validity_day":20}"#));
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
             VALUES ('parcela', 1000, 10, ?1, '2026-01', '2026-06', 3)",
            params![card],
        )
        .unwrap();
        let fb_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, fixed_bill_id, card_mode)
             VALUES ('fantasma', 4000, 2, '2026-06-15', ?1, ?2, 0)",
            params![card, fb_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id, card_mode)
             VALUES ('avulsa', 5000, 2, '2026-06-15', ?1, 0)",
            params![card],
        )
        .unwrap();

        let txs = card_bill_purchases(&conn, card, "2026-06-10", "2026-07-10").unwrap();

        assert!(txs.iter().any(|t| t.description == "avulsa"));
        assert!(
            txs.iter().all(|t| t.description != "fantasma"),
            "parcela além do total não pode aparecer no detalhe"
        );
        assert_eq!(txs.iter().map(|t| t.amount).sum::<i64>(), 5000);
    }
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src-tauri && cargo test fatura_detalhe_exclui_parcela_encerrada`
Expected: FAIL — fantasma presente.

- [ ] **Step 3: Implementar guard no WHERE**

Em `card_bill_purchases` (transactions.rs:174-188), trocar `conn.prepare("...")` por `conn.prepare(&format!(...))` adicionando o guard antes do `ORDER BY`:

```rust
    let mut stmt = conn
        .prepare(&format!(
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
               AND ({FINISHED_GUARD_SQL})
             ORDER BY t.date ASC, t.id ASC"
        ))
        .map_err(domain::db_err)?;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src-tauri && cargo test fatura_detalhe_exclui_parcela_encerrada`
Expected: PASS.

- [ ] **Step 5: Suíte completa + commit**

Run: `cd src-tauri && cargo test`

```bash
git add src-tauri/src/commands/transactions.rs
git commit -m "fix: detalhe da fatura exclui parcela alem do total"
```

---

### Task 6: `FixedBill.finished` na listagem de parcelamentos

**Files:**
- Modify: `src-tauri/src/models.rs:251-265` (FixedBill)
- Modify: `src-tauri/src/commands/fixed_bills.rs:15-52` (list)
- Modify: `lib/types.ts:68-81` (FixedBill TS)
- Test: `src-tauri/src/commands/fixed_bills.rs` mod tests

- [ ] **Step 1: Escrever teste que falha**

No `mod tests` de `src-tauri/src/commands/fixed_bills.rs` (criado na Task 2), adicionar:

```rust
    #[test]
    fn list_marca_finished_quando_plano_encerrou() {
        let conn = test_db();
        let pm = conn
            .execute("INSERT INTO payment_methods (name, type) VALUES ('PIX', 1)", [])
            .unwrap();
        let pm_id = conn.last_insert_rowid();
        // plano antigo, já encerrado (start no passado distante)
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
             VALUES ('antigo', 1000, 10, ?1, '2020-01', '2020-03', 3)",
            params![pm_id],
        )
        .unwrap();
        // plano começando no mês corrente
        let now = chrono::Local::now().date_naive().format("%Y-%m").to_string();
        conn.execute(
            "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
             VALUES ('novo', 1000, 10, ?1, ?2, ?2, 3)",
            params![pm_id, now],
        )
        .unwrap();

        let rows = list(&conn, true).unwrap();

        let antigo = rows.iter().find(|b| b.description == "antigo").expect("antigo presente");
        assert!(antigo.finished, "plano encerrado deve marcar finished");
        let novo = rows.iter().find(|b| b.description == "novo").expect("novo presente");
        assert!(!novo.finished, "plano corrente não está finished");
    }
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src-tauri && cargo test list_marca_finished_quando_plano_encerrou`
Expected: FAIL — campo `finished` não existe em `FixedBill`.

- [ ] **Step 3: Implementar campo + preencher na listagem**

Em `src-tauri/src/models.rs` `FixedBill` (após `purchase_date`), adicionar:

```rust
    /// Verdadeiro quando todas as parcelas já venceram (parcelamento encerrado).
    pub finished: bool,
```

Em `src-tauri/src/commands/fixed_bills.rs` `list`, trocar o fim da função (linhas 30-51):

```rust
    let mut stmt = conn.prepare(&sql).map_err(domain::db_err)?;
    let mut rows = stmt
        .query_map([], |r| {
            Ok(FixedBill {
                id: r.get(0)?,
                description: r.get(1)?,
                amount: r.get(2)?,
                day: r.get(3)?,
                category_id: r.get(4)?,
                category_name: r.get(5)?,
                payment_method_id: r.get(6)?,
                payment_method_name: r.get(7)?,
                start_month: r.get(8)?,
                end_month: r.get(9)?,
                installments: r.get(10)?,
                purchase_date: r.get(11)?,
                finished: false,
            })
        })
        .map_err(domain::db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(domain::db_err)?;
    let now = domain::current_month();
    for b in &mut rows {
        if let Some(n) = b.installments {
            b.finished = domain::installment_finished(&b.start_month, n, &now);
        }
    }
    Ok(rows)
```

Em `lib/types.ts` `FixedBill` (após `purchase_date: string | null;`), adicionar:

```typescript
  finished: boolean;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src-tauri && cargo test list_marca_finished_quando_plano_encerrou`
Expected: PASS.

- [ ] **Step 5: Suíte completa + commit**

Run: `cd src-tauri && cargo test`

```bash
git add src-tauri/src/models.rs src-tauri/src/commands/fixed_bills.rs lib/types.ts
git commit -m "feat: campo finished em parcelamentos"
```

---

### Task 7: `rowClass` genérico no CrudPage (plumbing)

**Files:**
- Modify: `components/crud/CrudPage.tsx:18-42` (CrudConfig), `:201-219` (render)
- Modify: `components/crud/DataTable.tsx:14-23,58-70`
- Modify: `components/crud/CardList.tsx:8-16,40-42`

- [ ] **Step 1: Adicionar `rowClass` ao `CrudConfig`**

Em `components/crud/CrudPage.tsx` `CrudConfig` (após `mobileCorners?`), adicionar:

```typescript
  /** Classe extra aplicada a cada linha/card (ex.: opacity para inativo). */
  rowClass?: (row: T) => string;
```

- [ ] **Step 2: Repassar em `DataTable` e `CardList`**

Em `components/crud/DataTable.tsx`:

```typescript
export function DataTable<T extends { id: number }>({
  columns, rows, selected, onToggle, onRowDoubleClick, loading, rowClass,
}: {
  columns: Column<T>[];
  rows: T[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onRowDoubleClick?: (row: T) => void;
  loading?: boolean;
  rowClass?: (row: T) => string;
}) {
```

e o `TableRow` (linha 58-63):

```tsx
          <TableRow
            key={row.id}
            className={cn("cursor-pointer", rowClass?.(row))}
            onClick={() => onToggle(row.id)}
            onDoubleClick={() => onRowDoubleClick?.(row)}
          >
```

Em `components/crud/CardList.tsx`, adicionar `import { cn } from "@/lib/utils";` no topo (junto aos imports existentes) e:

```typescript
export function CardList<T extends { id: number }>({
  corners, rows, loading, onTap, onLongPress, rowClass,
}: {
  corners: MobileCorners<T>;
  rows: T[];
  loading?: boolean;
  onTap?: (row: T) => void;
  onLongPress?: (row: T) => void;
  rowClass?: (row: T) => string;
}) {
```

e no botão (linha 42):

```tsx
            className={cn("w-full cursor-pointer select-none rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent active:bg-accent", rowClass?.(row))}
```

- [ ] **Step 3: Repassar no render do `CrudPage`**

Em `CrudPage.tsx` (linhas 202-219), adicionar `rowClass={config.rowClass}` ao `CardList` e ao `DataTable`.

- [ ] **Step 4: Verificar + commit**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: PASS.

```bash
git add components/crud/CrudPage.tsx components/crud/DataTable.tsx components/crud/CardList.tsx
git commit -m "feat: rowClass generico em CrudPage"
```

---

### Task 8: apagar plano encerrado na página de parcelamentos

**Files:**
- Modify: `app/installments/page.tsx:10-64`

- [ ] **Step 1: Usar `rowClass`**

Em `app/installments/page.tsx`, no `config` do `CrudPage`, adicionar:

```tsx
        rowClass: (r) => (r.finished ? "opacity-50" : ""),
```

(colocar após `loadResources` ou após `FormFields` — qualquer posição no objeto.)

- [ ] **Step 2: Verificar**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: PASS.

- [ ] **Step 3: Teste de regressão Rust**

Run: `cd src-tauri && cargo test`
Expected: PASS (31+ testes).

- [ ] **Step 4: Commit**

```bash
git add app/installments/page.tsx
git commit -m "feat: parcelamento encerrado meio apagado na lista"
```

---

### Task 9: verificação final + APK

- [ ] **Step 1: Suíte completa**

Run: `cd src-tauri && cargo test && cd .. && bun run typecheck && bun run lint && bun run build`
Expected: tudo PASS.

- [ ] **Step 2: Instalar no device (se disponível)**

```bash
export ANDROID_HOME=~/Android/Sdk NDK_HOME=~/Android/Sdk/ndk/25.2.9519653 JAVA_HOME=~/jdk17 PATH=~/jdk17/bin:$PATH
bun tauri android build --apk --target armv7
~/Android/Sdk/build-tools/34.0.0/apksigner sign --ks ~/Android/debug.keystore --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out /tmp/ajudafinancas-mobile.apk src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk
~/Android/Sdk/platform-tools/adb install -r /tmp/ajudafinancas-mobile.apk
~/Android/Sdk/platform-tools/adb shell am force-stop com.ajudafinancas.app
~/Android/Sdk/platform-tools/adb shell monkey -p com.ajudafinancas.app -c android.intent.category.LAUNCHER 1
```

- [ ] **Step 3: Teste manual no celular**
  - Lista de parcelamentos: plano cujo `start_month + total` já passou aparece apagado.
  - Fatura do cartão: compra parcelada com parcela além do total não aparece nem soma.
  - Criar parcelamento de cartão com compra em mês anterior ao corrente: não gera parcela além do total.
