# Design: Sort de tabelas via query no banco

**Data:** 2026-08-13
**Fonte:** TODOS.MD item 1 — sorts das tabelas não ordenam nada; clicar deve fazer nova query no banco conforme a ordenação pedida.

## Problema

`DataTable.tsx:63` usa `accessorKey: c.header` (rótulo pt-BR). Nenhuma row tem esses keys → `getValue()` retorna `undefined` → o sorted row model do TanStack v9 cai no fallback de ordem de inserção (`sortUndefined: 1`). Resultado: ícone muda, ordem nunca muda. O `sortFn` custom nunca é chamado. O sort é 100% client-side hoje; o backend nunca é consultado.

Bug latente adicional: `CrudPage.tsx:106` fatia o dataset antes da tabela (`pageRows = filtered.slice(0, visibleCount)` — infinite scroll). Sort client-side só ordenaria o lote visível. Sort no banco resolve porque o dataset completo volta ordenado.

## Decisões

- Sort **no banco** (servidor), como pedido no TODO.
- Escopo: **todas as 6 telas** (transactions, categories, fixed-bills, installments, loans, payment-methods).
- Ciclo do header: ASC → DESC → sem sort (padrão TanStack).
- Busca (search) continua client-side (`CrudPage.tsx:96-104`) — fora de escopo.
- Mobile (CardList) sem sort — não tem headers.

## Contrato de sort

Comandos `list_*` aceitam:

- `sort_by: Option<String>` — chave slug estável (`"date"`, `"amount"`, `"category"`…), resolvida por whitelist do comando → expressão SQL.
- `sort_dir: Option<String>` — `"asc" | "desc"` case-insensitive.
- `sort_by` ausente/desconhecido ou `sort_dir` inválido → ORDER BY default atual do comando.
- Whitelist obrigatória: nunca interpola string do usuário no SQL (anti-injection).

## Backend (Rust)

`domain.rs`: helper

```rust
fn order_clause(sort_by: Option<&str>, sort_dir: Option<&str>,
                whitelist: &[(&str, &str)], default: &str) -> String
```

Retorna `format!("ORDER BY {expr} {dir}")` quando resolvido; `default` (já com `ORDER BY`) caso contrário.

Comandos e whitelists:

| Comando | Chaves → SQL |
|---|---|
| `list_transactions` | date→`t.date`, type→`t.type`, description→`t.description`, category→`c.name`, payment_method→`pm.name`, amount→`t.amount` |
| `list_categories` | name→`name`, type→`type`, color→`color` |
| `list_fixed_bills` (e installments) | description→`b.description`, amount→`b.amount`, day→`b.day`, start→`b.start_month`, end→`b.end_month`, installments→`b.installments` |
| `list_loans` | description→`l.description`, type→`l.type`, principal→`l.principal`, installment→`l.installment`, installments→`l.total_installments`, start→`l.start_month`, end→`l.end_month` |
| `list_payment_methods` | name→`name`, type→`type` (Fechamento/Vencimento = JSON metadata → não sortable) |

Se o `ORDER BY` sozinho não desempatar, manter o critério default como secundário (ex: `ORDER BY {expr} {dir}, t.id DESC`).

## Frontend

- `Column<T>` (components/crud/types.ts:3) ganha `sortKey?: string`. Sem `sortKey` → header não-clicável.
- `CrudConfig.load` muda para `(sort: Sort | null) => Promise<T[]>` onde `Sort = { id: string; desc: boolean }`. `CrudPage` vira dono do estado de sort.
- `CrudPage.tsx`:
  - estado `sort: Sort | null`.
  - `effectiveKey = [...config.queryKey, sort]` → passado ao `useQuery`; `load` recebe `sort`.
  - `placeholderData: keepPreviousData` — evita flash de lista vazia durante refetch.
  - onSortChange → `setSort` + reset `visibleCount` (infinite scroll recomeça).
  - `invalidate` passa a usar `effectiveKey` (exact).
- `DataTable.tsx`:
  - sorting **controlado**: props `sorting`/`onSortingChange`, remove estado interno.
  - corrige raiz: `accessorKey: c.header` → `accessorFn` + `id` (para `getValue()` retornar valor real).
  - `getCanSort()` = presença de `sortKey`.
- `api.ts`: wrappers `list_*` passam `sort_by`/`sort_dir` ao `invoke`.
- Páginas: cada coluna recebe `sortKey` conforme whitelist do backend; `load` recebe o parâmetro sort.

## Fluxo de dados

1. Clique no header → `onSortingChange` → `setSort` no CrudPage.
2. `effectiveKey` muda → react-query refetch.
3. `invoke list_*(sort_by, sort_dir)` → ORDER BY no banco → dataset ordenado completo.
4. `filtered`/`pageRows` do CrudPage usam a ordem recebida.
5. 3º clique → `sort = null` → ordem default do banco.

## Erros

- `sort_by` fora da whitelist / `sort_dir` inválido → fallback default silencioso (nunca falha, nunca injeta).
- Falha de query → fluxo de erro existente do react-query (`CrudPage.tsx:159-166`).

## Testes

- Rust: unit test do `order_clause` — chave válida (asc/desc), chave desconhecida, dir inválido.
- Rust: test de `list_transactions` com sort, DB em memória.
