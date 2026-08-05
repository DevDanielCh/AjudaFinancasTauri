# Parcelamento por Data da Compra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Form de parcelamento aceita só a data da compra (cartões com fechamento/vencimento) e deriva mês/dia da 1ª parcela, guardando `purchase_date`.

**Architecture:** Coluna `purchase_date` em `fixed_bills`. No create/update, se `purchase_date` presente → `start_month`/`day` derivados da data e `apply_card_day` ignorado. Frontend alterna form: cartão → data da compra + dica; senão → campos atuais.

**Tech Stack:** Rust (rusqlite, tauri commands), Next.js 15 + shadcn/ui, TS.

**Comandos de verificação:**
- Rust: `cargo test` (em `src-tauri/`)
- Frontend: `bun run typecheck`, `bun run lint`, `bun run build`

---

### Task 1: Migração 004 e models

**Files:**
- Create: `src-tauri/migrations/004_fixed_bill_purchase_date.sql`
- Modify: `src-tauri/src/db.rs:11-14`
- Modify: `src-tauri/src/models.rs`

- [ ] **Step 1: Criar migração**

Create `src-tauri/migrations/004_fixed_bill_purchase_date.sql`:
```sql
ALTER TABLE fixed_bills ADD COLUMN purchase_date TEXT;
```

- [ ] **Step 2: Registrar migração**

In `src-tauri/src/db.rs`, adicionar `M::up(include_str!("../migrations/004_fixed_bill_purchase_date.sql"))` após o 003.

- [ ] **Step 3: Adicionar campo no input**

In `src-tauri/src/models.rs`, em `FixedBillInput`, adicionar `pub purchase_date: Option<String>,` após `pub installments`.

- [ ] **Step 4: Ajustar validate**

In `src-tauri/src/models.rs`, em `FixedBillInput::validate`, trocar o bloco de `day`/`start_month`:

```rust
if let Some(pd) = &self.purchase_date {
    chrono::NaiveDate::parse_from_str(pd, "%Y-%m-%d")
        .map_err(|_| "data da compra inválida".into())?;
} else {
    if !(1..=31).contains(&self.day) {
        return Err("dia deve estar entre 1 e 31".into());
    }
    month_str_to_date(&self.start_month)?;
}
```

- [ ] **Step 5: Adicionar campo no DTO**

In `src-tauri/src/models.rs`, em `FixedBill` (row DTO), adicionar `pub purchase_date: Option<String>,` após `pub installments`.

- [ ] **Step 6: Rodar testes**

Run (in `src-tauri/`): `cargo test`
Expected: PASS (migrações ok; DTO novo ainda não quebra nada).

- [ ] **Step 7: Commit**

```bash
git add src-tauri/migrations/004_fixed_bill_purchase_date.sql src-tauri/src/db.rs src-tauri/src/models.rs
git commit -m "feat: coluna purchase_date em fixed_bills"
```

---

### Task 2: domain — `purchase_installment` (TDD)

**Files:**
- Modify: `src-tauri/src/domain.rs`
- Test: `src-tauri/src/domain.rs` (módulo inline `#[cfg(test)]`)

- [ ] **Step 1: Escrever testes que falham**

In `src-tauri/src/domain.rs`, dentro do módulo `mod tests`, adicionar:

```rust
#[test]
fn purchase_installment_uses_purchase_month_and_day() {
    assert_eq!(purchase_installment("2025-11-20").unwrap(), ("2025-11".to_string(), 20));
    assert_eq!(purchase_installment("2025-01-05").unwrap(), ("2025-01".to_string(), 5));
}

#[test]
fn purchase_installment_rejects_invalid_date() {
    assert!(purchase_installment("20/11/2025").is_err());
    assert!(purchase_installment("garbage").is_err());
}
```

- [ ] **Step 2: Rodar para ver falhar**

Run (in `src-tauri/`): `cargo test purchase_installment`
Expected: FAIL (função não definida).

- [ ] **Step 3: Implementar**

In `src-tauri/src/domain.rs`, após `installment_index`:

```rust
/// (mês YYYY-MM, dia) do parcelamento a partir da data da compra.
pub fn purchase_installment(purchase: &str) -> Result<(String, i64), String> {
    let d = NaiveDate::parse_from_str(purchase, "%Y-%m-%d")
        .map_err(|_| "data da compra inválida".to_string())?;
    Ok((d.format("%Y-%m").to_string(), d.day() as i64))
}
```

- [ ] **Step 4: Teste de integração (parcela cai na fatura certa)**

In `src-tauri/src/domain.rs`, `mod tests`, adicionar:

```rust
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
    generate_fixed_bills(&conn, NaiveDate::from_ymd_opt(2026, 5, 1).unwrap()).unwrap();
    ensure_card_bills(&conn, NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()).unwrap();

    let total: i64 = conn
        .query_row(
            "SELECT amount FROM transactions WHERE description = 'Fatura - Nubank' AND date = '2026-06-20'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(total, 5000);
}
```

- [ ] **Step 5: Rodar testes**

Run (in `src-tauri/`): `cargo test`
Expected: PASS (novos testes + existentes).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/domain.rs
git commit -m "feat: purchase_installment deriva mes/dia da data da compra"
```

---

### Task 3: Backend — fixed_bills deriva a partir de purchase_date

**Files:**
- Modify: `src-tauri/src/commands/fixed_bills.rs`

- [ ] **Step 1: Incluir purchase_date no list**

In `src-tauri/src/commands/fixed_bills.rs::list`, no SELECT (linha 22-23), adicionar `b.purchase_date` após `b.installments` e no `FixedBill { ... }` adicionar `purchase_date: r.get(11)?,`.

- [ ] **Step 2: Novo helper apply_purchase_date**

In `src-tauri/src/commands/fixed_bills.rs`, após `apply_card_day`:

```rust
/// Deriva mês/dia do parcelamento a partir da data da compra.
fn apply_purchase_date(input: &mut FixedBillInput) -> Result<(), String> {
    if let Some(pd) = input.purchase_date.clone() {
        let (start_month, day) = domain::purchase_installment(&pd)?;
        input.start_month = start_month;
        input.day = day;
    }
    Ok(())
}
```

- [ ] **Step 3: create/update usam purchase_date quando presente**

In `create_fixed_bill` e `update_fixed_bill`, dentro do closure do `with_db`, trocar a chamada única `apply_card_day(c, &mut input)?;` por:

```rust
if input.purchase_date.is_some() {
    apply_purchase_date(&mut input)?;
} else {
    apply_card_day(c, &mut input)?;
}
```

- [ ] **Step 4: Rodar testes**

Run (in `src-tauri/`): `cargo test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/fixed_bills.rs
git commit -m "feat: create/update deriva inicio e dia da data da compra"
```

---

### Task 4: Frontend — tipos, form e recursos

**Files:**
- Modify: `lib/types.ts:66-89`
- Modify: `components/forms/FixedBillForm.tsx`
- Modify: `app/fixed-bills/page.tsx`
- Modify: `app/installments/page.tsx`

- [ ] **Step 1: Tipos**

In `lib/types.ts`, em `FixedBill` e `FixedBillInput`, adicionar `purchase_date: string | null;` após `installments`.

- [ ] **Step 2: Recursos com cardValidityDays**

In `components/forms/FixedBillForm.tsx`, na interface `FixedBillResources`, adicionar `cardValidityDays: Record<number, number>;`.

- [ ] **Step 3: Form — cartão com data da compra**

In `components/forms/FixedBillForm.tsx`:
- Import `formatMonth` de `@/lib/format`.
- Adicionar `const cardValidity = value.payment_method_id ? resources.cardValidityDays[value.payment_method_id] : undefined;` ao lado de `cardDay`.
- Adicionar helper no componente:

```tsx
const faturaMonth = (purchase: string, close: number) => {
  const [y, m, d] = purchase.split("-").map(Number);
  const [ny, nm] = d >= close ? (m === 12 ? [y + 1, 1] : [y, m + 1]) : [y, m];
  return formatMonth(`${ny}-${String(nm).padStart(2, "0")}`);
};
const isCardInstallment =
  mode === "installments" &&
  !!value.payment_method_id &&
  !!resources.cardCloseDays[value.payment_method_id] &&
  !!resources.cardValidityDays[value.payment_method_id];
```

- No `onChange` da `NativeSelect` de forma de pagamento, incluir limpeza:

```tsx
onChange={(e) => {
  const id = Number(e.target.value);
  const isCard = !!resources.cardCloseDays[id] && !!resources.cardValidityDays[id];
  onChange({ ...value, payment_method_id: id, purchase_date: isCard ? value.purchase_date : null });
}}
```

- Reestruturar JSX: o bloco Início + Dia fica dentro de `{!(mode === "installments" && isCardInstallment) && (<> Início + Dia </>)}`.
- Em `mode === "installments"`, quando `isCardInstallment`, renderizar no lugar de Início + Dia:

```tsx
<Field>
  <FieldLabel>Data da compra</FieldLabel>
  <Input type="date" value={value.purchase_date ?? ""}
    onChange={(e) => onChange({ ...value, purchase_date: e.target.value || null })} />
  {value.purchase_date && cardDay && cardValidity && (
    <p className="text-xs text-muted-foreground">
      1ª parcela na fatura de {faturaMonth(value.purchase_date, cardDay)} • fecha dia {cardDay} • vence dia {cardValidity}
    </p>
  )}
</Field>
```

- [ ] **Step 4: Páginas montam cardValidityDays**

In `app/fixed-bills/page.tsx` e `app/installments/page.tsx`:
- No `loadResources`, adicionar após o loop de `cardCloseDays`:

```tsx
const cardValidityDays: Record<number, number> = {};
for (const pm of paymentMethods) {
  if (pm.type === 2 && pm.metadata) {
    try {
      const m = JSON.parse(pm.metadata);
      if (m.validity_day) cardValidityDays[pm.id] = m.validity_day;
    } catch { /* ignore */ }
  }
}
```

E retornar `{ categories, paymentMethods, cardCloseDays, cardValidityDays }`.

- Nos `empty()` e `toInput()` das duas páginas, incluir `purchase_date`:

```tsx
empty: (): FixedBillInput => ({
  description: "", amount: 0, day: 1, category_id: null,
  payment_method_id: 0, start_month: new Date().toISOString().slice(0, 7),
  end_month: null, installments: null, purchase_date: null,
}),
toInput: (r): FixedBillInput => ({
  description: r.description, amount: r.amount, day: r.day,
  category_id: r.category_id, payment_method_id: r.payment_method_id,
  start_month: r.start_month, end_month: r.end_month,
  installments: r.installments, purchase_date: r.purchase_date,
}),
```

- [ ] **Step 5: Verificar frontend**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts components/forms/FixedBillForm.tsx app/fixed-bills/page.tsx app/installments/page.tsx
git commit -m "feat: form de parcelamento com data da compra para cartoes"
```

---

### Task 5: Verificação final

- [ ] **Step 1: Rodar tudo**

Run (in `src-tauri/`): `cargo test`
Run: `bun run typecheck && bun run lint && bun run build`
Expected: TUDO PASS.

- [ ] **Step 2: Commit final**

```bash
git status --short
# se houver mudanças não commitadas: git commit -am "chore: ajustes finais"
```
