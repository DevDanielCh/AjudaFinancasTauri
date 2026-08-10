# Modo débito/crédito em compras de cartão — Design

Data: 2026-08-09
Status: aprovado

## Objetivo

Ao cadastrar uma despesa com forma de pagamento cartão, permitir escolher
débito ou crédito. Crédito entra na fatura do cartão (comportamento atual);
débito é transação simples: aparece na listagem, conta como despesa no mês da
compra e nunca entra na fatura.

## Mudanças

### Migração `006_card_debit.sql`

```sql
ALTER TABLE transactions ADD COLUMN card_mode INTEGER NOT NULL DEFAULT 0;
```

- `0` = crédito, `1` = débito.
- `DEFAULT 0` preserva linhas existentes: compras de cartão atuais continuam
  crédito (entram na fatura), contas fixas/parcelas/empréstimos em cartão
  seguem crédito.

### Backend (Rust)

- `models.rs:TransactionInput` — novo campo `card_mode: i64` com
  `#[serde(default)]`; `validate()` rejeita valores fora de {0, 1}.
- `models.rs:TransactionRow` — novo campo `card_mode: i64`.
- `commands/transactions.rs:create_transaction` / `update_transaction` —
  incluir `card_mode` no INSERT/UPDATE.
- `commands/transactions.rs:list` — SELECT inclui `t.card_mode`; filtro de
  ocultação de compras de cartão passa a esconder só **crédito** (`card_mode=0`)
  para cartões com fatura; compra débito aparece na listagem.
- `domain.rs:card_bill` (query ~linha 204) — adicionar `AND card_mode = 0`:
  só crédito alimenta a fatura.
- `commands/transactions.rs:get_card_bill` (query ~linha 189) — adicionar
  `AND card_mode = 0` na lista de compras da fatura.
- `domain.rs:month_expenses` (~linha 297) — cartão com fatura não pula mais
  todas as compras: soma compras débito (`card_mode=1`) no mês civil da compra;
  crédito continua contando só via fatura `type=3`.
- `domain.rs:expenses_by_pm` (~linha 378) — ramo cartão soma fatura (`type=3`)
  + compras débito (`card_mode=1`) do mês.

Sem mudança: `ensure_card_bills`/`refresh_card_bills` (só recalculam faturas
com compras crédito), `is_card_bill`, proteção de fatura.

### Frontend (TS/React)

- `lib/types.ts` — `TransactionInput.card_mode: number`; `TransactionRow.card_mode: number`.
- `components/forms/TransactionForm.tsx` — quando `type===2` e a forma de
  pagamento selecionada for cartão (`type===2`), renderizar ToggleGroup
  "Débito"/"Crédito" (padrão **Crédito**, decisão do usuário). Toggle seta
  `value.card_mode` (1/0). Trocar para forma não-cartão → `card_mode=0`.
- `app/transactions/page.tsx` — `empty()` e `toInput()` preenchem `card_mode`.

### Testes

- `domain.rs` (mod tests) — débito não entra na fatura; débito conta em
  `month_expenses`; crédito continua na fatura.
- `commands/get_card_bill` — compra débito não aparece no detalhe da fatura.
