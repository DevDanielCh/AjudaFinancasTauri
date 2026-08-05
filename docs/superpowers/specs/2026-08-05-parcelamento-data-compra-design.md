# Parcelamento por Data da Compra — Design

Data: 2026-08-05
Status: aprovado

## Objetivo

No cadastro de parcelamento (installments), permitir informar apenas a **data da
compra** (ex: 20/11/2025) quando a forma de pagamento é cartão com
fechamento/vencimento configurados. O sistema deriva o mês de início e o dia da
primeira parcela. Reduz 2 campos do form para 1. A data da compra fica guardada
no registro para edição consistente.

## Semântica

- **Início** = mês da compra; **dia** = dia da compra.
- A fatura que cobra cada parcela é derivada pela lógica existente de período de
  fatura `[fechamento anterior, fechamento atual)`. Compra após o fechamento cai
  na fatura do mês seguinte — ajuste automático, sem cálculo manual.
- Cartão sem fechamento/vencimento e formas não-cartão (PIX, boleto): form
  mantém campos atuais (Início + Dia).

## Mudanças

### Migração `004_fixed_bill_purchase_date.sql`

```sql
ALTER TABLE fixed_bills ADD COLUMN purchase_date TEXT;
```

### Backend (Rust)

- `models.rs`
  - `FixedBillInput.purchase_date: Option<String>`.
  - `FixedBill.purchase_date: Option<String>`.
  - `validate()`: se `purchase_date` presente, exige `YYYY-MM-DD` válida e pula a
    validação de `day`/`start_month` (serão derivados no create/update).
- `domain.rs` — novo `purchase_installment(purchase: &str) -> Result<(String, i64), String>`:
  retorna `(mês YYYY-MM, dia)` da data da compra. Data inválida → erro.
- `fixed_bills.rs`
  - `list`: incluir `purchase_date` no SELECT e no DTO.
  - create/update: se `purchase_date` presente → `start_month`/`day` derivados via
    `purchase_installment` e `apply_card_day` NÃO é chamado; senão, comportamento
    atual (`apply_card_day`).
  - `delete_fixed_bills`: inalterado.

### Frontend (TS/React)

- `lib/types.ts` — `FixedBill` e `FixedBillInput` com `purchase_date: string | null`.
- `FixedBillForm` (modo `installments`):
  - Se forma é cartão com `close_day` e `validity_day` (`cardCloseDays` +
    `cardValidityDays`): renderiza **Data da compra** (input `type="date"`) e uma
    dica calculada: "1ª parcela na fatura de {mês} • fecha dia {c} • vence dia {v}".
    Esconde Início e Dia.
  - Senão: campos atuais (Início + Dia). Trocar a forma para não-cartão limpa
    `purchase_date`.
- `app/fixed-bills/page.tsx` e `app/installments/page.tsx` — `loadResources`
  passa a montar `cardValidityDays: Record<number, number>` além de
  `cardCloseDays`.
- Modo `recurring` (Contas Fixas): inalterado.

### Testes

- `domain.rs` (unit): `purchase_installment("2025-11-20")` → `("2025-11", 20)`;
  data inválida → erro.
- `domain.rs` (integração): cartão fecha dia 10 / vence dia 20; fixed_bill
  parcelado com `start_month=2026-05`, `day=20`; `generate_fixed_bills(2026-05)`;
  `ensure_card_bills(2026-06)` → fatura de junho contém a parcela.
