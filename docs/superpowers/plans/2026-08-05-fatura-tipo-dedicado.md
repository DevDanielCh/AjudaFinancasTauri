# Tipo Dedicado para Fatura de Cartão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fatura de cartão vira transação `type=3` (dedicada) e fica protegida contra edição/exclusão na UI e na API.

**Architecture:** Migração marca faturas existentes com `type=3`. `ensure_card_bills` passa a inserir `type=3`. Guardas em `update_transaction`/`delete_ids` rejeitam fatura. Frontend: badge "Fatura", botão Editar desabilita e Excluir filtra faturas via nova opção `protected` no CrudPage. Marcadores `bill_start`/`bill_end` permanecem.

**Tech Stack:** Rust (rusqlite, tauri commands), Next.js 15 + shadcn/ui, TS.

**Comandos de verificação:**
- Rust: `cargo test` (em `src-tauri/`)
- Frontend: `bun run typecheck`, `bun run lint`, `bun run build`

---

### Task 1: Migração 003 e registro

**Files:**
- Create: `src-tauri/migrations/003_card_bill_type.sql`
- Modify: `src-tauri/src/db.rs:11-14`

- [ ] **Step 1: Criar migração**

Create `src-tauri/migrations/003_card_bill_type.sql`:
```sql
UPDATE transactions SET type = 3 WHERE bill_start IS NOT NULL;
```

- [ ] **Step 2: Registrar migração**

In `src-tauri/src/db.rs`, add `M::up(include_str!("../migrations/003_card_bill_type.sql"))` to the `Migrations::new` vec, after 002.

- [ ] **Step 3: Rodar testes**

Run (in `src-tauri/`): `cargo test`
Expected: PASS (migrations ainda criam schema + seed).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/migrations/003_card_bill_type.sql src-tauri/src/db.rs
git commit -m "feat: migracao 003 marca faturas como tipo 3"
```

---

### Task 2: Backend — geração e contabilidade com type=3

**Files:**
- Modify: `src-tauri/src/domain.rs:226`, `:297`, `:362`
- Test: `src-tauri/src/domain.rs` (módulo inline `#[cfg(test)]`, teste `ensures_card_bill_period_and_due` ~linha 704)

- [ ] **Step 1: Escrever asserção de tipo no teste**

In `src-tauri/src/domain.rs`, no teste inline `ensures_card_bill_period_and_due`, mudar a consulta para incluir `type` e asserir `type == 3`:

```rust
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
```

- [ ] **Step 2: Rodar teste para ver falhar**

Run (in `src-tauri/`): `cargo test ensures_card_bill_period_and_due`
Expected: FAIL com `left: 2, right: 3`.

- [ ] **Step 3: Trocar INSERT da fatura para type=3**

In `src-tauri/src/domain.rs:226`, o `INSERT INTO transactions` dentro de `ensure_card_bills`:
- Trocar `VALUES (?1, ?2, 2, ?3, ?4, ?5, ?6)` por `VALUES (?1, ?2, 3, ?3, ?4, ?5, ?6)`.

- [ ] **Step 4: Contabilidade usa type=3**

In `src-tauri/src/domain.rs`:
- Linha ~297 (`month_expenses`, soma das faturas): trocar `WHERE bill_start IS NOT NULL AND date >= ?1` por `WHERE type = 3 AND date >= ?1`.
- Linha ~362 (`expenses_by_pm`, ramo de cartão): trocar `WHERE bill_start IS NOT NULL AND payment_method_id = ?1` por `WHERE type = 3 AND payment_method_id = ?1`.

- [ ] **Step 5: Rodar testes**

Run (in `src-tauri/`): `cargo test`
Expected: PASS (inclui `ensures_card_bill_period_and_due`, `month_expenses_counts_bill_not_card_purchases`).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/domain.rs src-tauri/tests/domain_test.rs
git commit -m "feat: fatura gerada com type 3 e contada como despesa"
```

---

### Task 3: Backend — guardas de proteção + helper

**Files:**
- Modify: `src-tauri/src/domain.rs` (novo `is_card_bill`)
- Modify: `src-tauri/src/commands/transactions.rs:101-131`, `:144-150`
- Test: `src-tauri/tests/transactions_protect_test.rs`

- [ ] **Step 1: Escrever testes que falham**

Create `src-tauri/tests/transactions_protect_test.rs`:

```rust
use ajudafinancas_lib::commands::transactions::delete_ids;
use ajudafinancas_lib::db::migrations;
use ajudafinancas_lib::domain;
use rusqlite::{params, Connection};

fn test_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    migrations().to_latest(&mut conn).unwrap();
    conn
}

fn insert_fatura(conn: &Connection) -> i64 {
    conn.execute(
        "INSERT INTO transactions (description, amount, type, date, payment_method_id, bill_start, bill_end)
         VALUES ('Fatura - Nubank', 5000, 3, '2026-06-20', 3, '2026-05-10', '2026-06-10')",
        [],
    )
    .unwrap();
    conn.last_insert_rowid()
}

fn insert_normal(conn: &Connection) -> i64 {
    conn.execute(
        "INSERT INTO transactions (description, amount, type, date) VALUES ('Pix', 100, 2, '2026-06-05')",
        [],
    )
    .unwrap();
    conn.last_insert_rowid()
}

#[test]
fn is_card_bill_identifica_fatura() {
    let conn = test_db();
    let f = insert_fatura(&conn);
    let n = insert_normal(&conn);
    assert!(domain::is_card_bill(&conn, f).unwrap());
    assert!(!domain::is_card_bill(&conn, n).unwrap());
}

#[test]
fn delete_ids_rejeita_fatura() {
    let conn = test_db();
    let f = insert_fatura(&conn);
    let n = insert_normal(&conn);
    delete_ids(&conn, &[n]).unwrap();
    assert!(delete_ids(&conn, &[f]).is_err());
    assert!(delete_ids(&conn, &[n, f]).is_err());
}
```

- [ ] **Step 3: Rodar testes para ver falhar**

Run (in `src-tauri/`): `cargo test --test transactions_protect_test`
Expected: FAIL com "unresolved import" (`is_card_bill` ainda não existe). `delete_ids` já é `pub` e `pub mod commands/domain` já existem em `src-tauri/src/lib.rs` — sem mudança necessária ali.

- [ ] **Step 4: Implementar helper `is_card_bill`**

In `src-tauri/src/domain.rs`, adicionar import `params` ao `use rusqlite::Connection;` (virar `use rusqlite::{params, Connection};`) e adicionar:

```rust
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
```

- [ ] **Step 5: Guarda no update**

In `src-tauri/src/commands/transactions.rs::update_transaction`, no início do `with_db` closure (antes do `UPDATE`):

```rust
if domain::is_card_bill(c, id)? {
    return Err("fatura é gerada automaticamente e não pode ser editada".into());
}
```

- [ ] **Step 6: Guarda no delete**

In `src-tauri/src/commands/transactions.rs::delete_ids`, no início:

```rust
for id in ids {
    if domain::is_card_bill(conn, *id)? {
        return Err("fatura é gerada automaticamente e não pode ser excluída".into());
    }
}
```

- [ ] **Step 7: Rodar testes**

Run (in `src-tauri/`): `cargo test`
Expected: PASS (inclui `transactions_protect_test`).

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/domain.rs src-tauri/src/commands/transactions.rs src-tauri/tests/transactions_protect_test.rs
git commit -m "feat: fatura protegida contra edicao e exclusao"
```

---

### Task 4: Frontend — tipo 3, badge e proteção no CrudPage

**Files:**
- Modify: `lib/types.ts:16-30`
- Modify: `components/crud/CrudPage.tsx:13-35`, `:83-89`, `:132-142`
- Modify: `app/transactions/page.tsx:23-35`, `:45-48`

- [ ] **Step 1: Tipo 3 no TransactionRow**

In `lib/types.ts`, `TransactionRow.type` muda de `1 | 2` para `1 | 2 | 3`. `TransactionInput.type` permanece `1 | 2`.

- [ ] **Step 2: Opção `protected` no CrudConfig**

In `components/crud/CrudPage.tsx`:
- Interface `CrudConfig`: adicionar `protected?: (row: T) => boolean;`
- Botão **Editar** (linhas 132-142): desabilitar quando o único selecionado é protegido:

```tsx
const singleSelected = selected.size === 1 ? rows.find((r) => r.id === [...selected][0]) : undefined;
const editDisabled = !singleSelected || (config.protected?.(singleSelected) ?? false);
```

E usar `disabled={editDisabled}` no botão Editar.

- `askDelete` (linhas 83-89): filtrar protegidos e avisar se sobrar nenhum:

```tsx
const askDelete = () => {
  const ids = [...selected].filter((id) => {
    const row = rows.find((r) => r.id === id);
    return !(row && config.protected?.(row));
  });
  if (ids.length === 0) {
    toast.add({ title: "Faturas são geradas automaticamente e não podem ser excluídas", type: "error" });
    return;
  }
  setConfirm({ ids, message: ids.length === 1 ? "Excluir este registro?" : `Excluir ${ids.length} registros?` });
};
```

- [ ] **Step 3: Badge e protected na página de transações**

In `app/transactions/page.tsx`:
- Importar `Badge` de `@/components/ui/badge`.
- Coluna **Descrição** renderiza badge para fatura:

```tsx
{ header: "Descrição", render: (r) => (
  <span className="flex items-center gap-2">
    {r.is_card_bill && <Badge>Fatura</Badge>}
    {r.description}
  </span>
) },
```

- Coluna **Valor**: usar `r.type === 1 ? "text-positive" : "text-negative"` e `r.type === 1 ? "+" : "−"` (já cobre type 3 como despesa — sem mudança no render, conferir apenas).
- `toInput` (linhas 45-48): faturas nunca são editadas, mas o tipo precisa compilar; mapear 3 → 2:

```tsx
toInput: (r): TransactionInput => ({
  description: r.description, amount: r.amount,
  type: r.type === 3 ? 2 : r.type, date: r.date,
  category_id: r.category_id, payment_method_id: r.payment_method_id,
}),
```

- Config: adicionar `protected: (r) => r.is_card_bill,`.

- [ ] **Step 4: Verificar frontend**

Run: `bun run typecheck && bun run lint`
Expected: PASS sem erros.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts components/crud/CrudPage.tsx app/transactions/page.tsx
git commit -m "feat: tipo 3 na UI, badge fatura e protecao no crud"
```

---

### Task 5: Verificação final

- [ ] **Step 1: Rodar tudo**

Run (in `src-tauri/`): `cargo test`
Run: `bun run typecheck && bun run lint && bun run build`
Expected: TUDO PASS.

- [ ] **Step 2: Commit final**

```bash
git commit -am "chore: verificacao final tipo fatura dedicado" # apenas se houver mudanças não commitadas
```
