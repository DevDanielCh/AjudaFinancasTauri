# Parcelamento encerrado: apagado na lista e fora da fatura — Design

Data: 2026-08-09
Status: aprovado

## Objetivo

Quando um parcelamento chega ao fim, ele deve ser reconhecido como encerrado:
a lista de parcelamentos mostra o plano **meio apagado**, e a fatura do cartão
**não considera mais** nenhuma parcela além do total informado (parcela atual
> quantidade de parcelas). A regra vale para a lista de parcelamentos e para o
agrupamento das faturas do cartão.

## Definição de "encerrado"

Decisão do usuário: um plano está encerrado quando o **índice da parcela do
mês atual ultrapassa o total** de parcelas:

```
index = month_diff(start_month, row_month) + 1   (min. 1, domínio atual)
encerrado ⇔ index > installments  ⇔  month_diff(start_month, row_month) >= installments
```

Na lista (plano inteiro): `row_month` = mês corrente.
Na fatura (linha): `row_month` = mês da linha (`t.date`).

## Causa raiz do vazamento

`normalized()` (models.rs) deriva `end_month = start_month + n - 1` a partir do
`start_month` do formulário; depois `apply_purchase_date` sobrescreve
`start_month` com o mês da compra. Quando a compra é anterior ao mês do
formulário, `end_month` fica largo demais e `generate_fixed_bills` cria linhas
além do total. A fatura agrupa por intervalo de data apenas, sem checar o
índice — as linhas excedentes entram na fatura.

## Mudanças

### 1. Lista de parcelamentos: plano encerrado apagado

- `models.rs:FixedBill` — novo campo `finished: bool`.
- `commands/fixed_bills.rs:list` — após o SELECT, setar
  `finished = domain::installment_finished(start_month, installments, current_month)`
  quando `installments` presente; `false` caso contrário.
- `domain.rs` — novo helper `pub fn installment_finished(start_month: &str, installments: i64, row_month: &str) -> bool`
  (`installments >= 1 && installment_index(start_month, row_month) > installments`).
- `lib/types.ts` — `FixedBill.finished: boolean`.
- `components/crud/types.ts` — novo campo opcional `rowClass?: (r: T) => string` no config.
- `components/crud/CrudPage.tsx` — repassa `config.rowClass` a `DataTable` e `CardList`.
- `components/crud/DataTable.tsx` — `TableRow` ganha `cn("cursor-pointer", rowClass?.(row))`.
- `components/crud/CardList.tsx` — botão do card ganha `cn(..., rowClass?.(row))`.
- `app/installments/page.tsx` — `rowClass={(r) => r.finished && "opacity-50"}`
  (mesmo padrão de parcela quitada em `components/loans/DetailDialog.tsx`).
  Plano encerrado continua selecionável/ediável.

### 2. Fatura do cartão: excluir parcela além do total

Regra: linha é excluída da fatura quando é parcela de conta fixa e
`month_diff(fb.start_month, t.date) >= fb.installments`.

- `domain.rs` — fragmento SQL compartilhado do guard (expressão `month_diff`
  em SQLite sobre `fb.start_month` e `t.date`), aplicado nos dois pontos:
  - `card_bill` (SUM → valor da fatura gerada): adicionar
    `LEFT JOIN fixed_bills fb ON fb.id = transactions.fixed_bill_id` +
    guard no WHERE.
  - `commands/transactions.rs:card_bill_purchases` (detalhe): guard no WHERE
    (join `fb` já existe).
- Empréstimos e compras avulsas no cartão (`fb.installments IS NULL`) não são
  afetados — continuam na fatura.

### 3. Causa raiz: geração de planos

- `commands/fixed_bills.rs:create_fixed_bill` e `update_fixed_bill` — reordenar:
  aplicar `apply_purchase_date`/`apply_card_day` **antes** de `normalized()` e
  de `validate()`. Assim `end_month` deriva do `start_month` final (mês da
  compra) → planos novos nunca mais geram parcela além do total.
- `domain.rs:generate_fixed_bills` — condição extra no WHERE: plano com
  `installments` deixa de gerar quando `month_diff(start_month, ?1) >=
  installments` (além de `end_month`). Planos antigos com drift param de cuspir
  linhas fantasma; linhas fantasma já existentes continuam excluídas da fatura
  pelo guard (§2).

Sem mudança: `end_month` continuará sendo armazenado (usado na lista e como
display); não há migração de dados existentes.

### 4. Testes

- `domain.rs` (mod tests, via `test_db`):
  - `installment_finished` — bordas (antes do início → false; último mês →
    false; mês seguinte ao último → true).
  - `card_bill` exclui parcela além do total (SUM) e mantém as demais.
  - `generate_fixed_bills` não gera além de `start_month + total - 1`.
- `commands/fixed_bills.rs` (mod tests ou teste de integração):
  - `list_fixed_bills` marca `finished` quando o plano terminou.
  - `create_fixed_bill` com compra anterior ao mês do formulário gera plano com
    `end_month` correto (drift corrigido).
- `commands/transactions.rs` (mod tests):
  - `card_bill_purchases` não retorna linha além do total (detalhe da fatura).
- Frontend: `bun run typecheck && bun run lint && bun run build`.
