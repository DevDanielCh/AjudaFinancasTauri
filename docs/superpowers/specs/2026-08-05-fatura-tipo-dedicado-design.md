# Tipo dedicado para Fatura de Cartão — Design

Data: 2026-08-05
Status: aprovado

## Objetivo

Dar identidade própria à transação de fatura de cartão de crédito e proteger o
registro: hoje a fatura é `type=2` (despesa) diferenciada apenas por
`bill_start IS NOT NULL`. Passa a ter `type=3`, aparece distinta na listagem e
não pode ser editada nem deletada pela tela de transações nem pela API.

## Mudanças

### Migração `003_card_bill_type.sql`

```sql
UPDATE transactions SET type = 3 WHERE bill_start IS NOT NULL;
```

Marcadores `bill_start`/`bill_end` permanecem (dedup, período, detalhe). Fatura
sempre é gerada por `ensure_card_bills`, nunca criada manualmente.

### Backend (Rust)

- `domain.rs:226` — `ensure_card_bills` insere fatura com `type = 3` (era 2).
- `domain.rs:297` — `month_expenses`: soma de faturas passa a `type = 3`
  (continua contando como despesa).
- `domain.rs:362` — `expenses_by_pm`: ramo de cartão usa `type = 3`.
- `transactions.rs:update_transaction` — rejeita edição de fatura (type 3):
  "fatura é gerada automaticamente e não pode ser editada".
- `transactions.rs:delete_transactions` — rejeita exclusão se qualquer id for
  fatura (type 3).
- `models.rs:TransactionInput::validate` — já só aceita 1/2; sem mudança.
- Compras do cartão continuam `type=2` (`card_bill`, `domain.rs:186`).

### Frontend (TS/React)

- `lib/types.ts` — `TransactionRow.type: 1 | 2 | 3`.
- `components/crud/CrudPage.tsx` — nova opção `protected?: (row) => boolean`:
  - botão **Editar** desabilita se o único selecionado é protegido;
  - **Excluir** filtra registros protegidos da seleção antes de confirmar.
- `app/transactions/page.tsx` — fatura (`type=3`) mostra valor em vermelho com
  badge "Fatura"; `protected: (r) => r.is_card_bill`. Botão **Visualizar**
  continua abrindo `FaturaDetailDialog`.

### Testes

- `src-tauri/tests/` — teste novo: update/delete de fatura rejeitado.
- Testes existentes não assertam `type` da fatura; nada a ajustar.
