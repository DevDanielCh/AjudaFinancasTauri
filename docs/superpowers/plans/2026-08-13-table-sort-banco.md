# Sort de tabelas via query no banco — Plano de Implementação

> **Para agentic workers:** SUB-SKILL OBRIGATÓRIA: usar superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa por tarefa. Passos usam checkbox (`- [ ]`).

**Goal:** Fazer o clique no header de tabelas disparar nova query ao banco com ORDER BY, em todas as 6 telas (transactions, categories, fixed-bills, installments, loans, payment-methods).

**Architecture:** Backend Rust: cada comando `list_*` ganha params `sort_by`/`sort_dir`, resolvidos por whitelist própria via helper `order_clause` em `domain.rs` (fallback silencioso ao ORDER BY default atual). Frontend: `CrudPage` vira dono do estado de sort, coloca sort no `queryKey` do react-query (refetch automático) e passa sort controlado ao `DataTable`. `Column` ganha `sortKey` (chave da whitelist). Busca continua client-side.

**Tech Stack:** Rust (rusqlite, tauri), TypeScript, Next.js 16 App Router, TanStack Table v9, TanStack Query v5.

**Spec:** `docs/superpowers/specs/2026-08-13-table-sort-banco-design.md`

---

## Contrato de chaves (frontend ↔ backend)

Mesmas chaves `sortKey` nos dois lados. Tabela de referência:

| Tela | Coluna → sortKey | SQL na whitelist |
|---|---|---|
| transactions | Data→`date`, Tipo→`type`, Descrição→`description`, Categoria→`category`, Forma→`payment_method`, Valor→`amount` | `t.date`, `t.type`, `t.description`, `c.name`, `pm.name`, `t.amount` |
| categories | Cor→`color`, Nome→`name`, Tipo→`type` | `color`, `name`, `type` |
| payment-methods | Nome→`name`, Tipo→`type` (Fechamento/Vencimento **sem** sortKey) | `name`, `type` |
| fixed-bills | Descrição→`description`, Valor→`amount`, Dia→`day`, Início→`start`, Fim→`end` | `b.description`, `b.amount`, `b.day`, `b.start_month`, `b.end_month` |
| installments | Igual fixed-bills + Parcelas→`installments` | + `b.installments` |
| loans | Descrição→`description`, Tipo→`type`, Valor→`principal`, Parcela→`installment`, Parcelas→`installments`, Início→`start` (Fim **sem** sortKey — `end_month` é getter computado, não existe coluna) | `l.description`, `l.type`, `l.principal`, `l.installment`, `l.total_installments`, `l.start_month` |

---

## Task 1: Helper `order_clause` no domain.rs (TDD)

**Files:**
- Modify: `src-tauri/src/domain.rs` (após `db_err`, ~linha 139)
- Test: mesmo arquivo, dentro do `mod tests` existente (linha 932)

- [ ] **Step 1: Escrever o teste que falha**

Dentro do `mod tests` de `domain.rs` (após `fn test_db()`, que termina na linha ~947), adicionar:

```rust
#[test]
fn order_clause_chave_valida() {
    let wl = &[("amount", "t.amount"), ("date", "t.date")];
    assert_eq!(
        order_clause(Some("amount"), Some("asc"), wl, "ORDER BY t.date DESC, t.id DESC", "t.id DESC"),
        "ORDER BY t.amount ASC, t.id DESC"
    );
    assert_eq!(
        order_clause(Some("amount"), Some("desc"), wl, "ORDER BY t.date DESC, t.id DESC", "t.id DESC"),
        "ORDER BY t.amount DESC, t.id DESC"
    );
}

#[test]
fn order_clause_fallback_padrao() {
    let wl = &[("amount", "t.amount")];
    assert_eq!(order_clause(None, None, wl, "ORDER BY t.date DESC", "t.id DESC"), "ORDER BY t.date DESC");
    assert_eq!(order_clause(Some("unknown"), Some("asc"), wl, "ORDER BY t.date DESC", "t.id DESC"), "ORDER BY t.date DESC");
    assert_eq!(order_clause(Some("amount"), Some("bogus"), wl, "ORDER BY t.date DESC", "t.id DESC"), "ORDER BY t.date DESC");
}
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `cargo test order_clause` (workdir `src-tauri`)
Expected: FAIL — `cannot find function order_clause in this scope`

- [ ] **Step 3: Implementar**

Adicionar após `pub fn db_err(...)` em `domain.rs`:

```rust
pub fn order_clause(
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
    whitelist: &[(&str, &str)],
    default: &str,
    tiebreak: &str,
) -> String {
    let Some(key) = sort_by else {
        return default.to_string();
    };
    let Some(expr) = whitelist.iter().find(|(k, _)| *k == key).map(|(_, e)| *e) else {
        return default.to_string();
    };
    let dir = match sort_dir.map(|d| d.to_ascii_lowercase()).as_deref() {
        Some("asc") => "ASC",
        Some("desc") => "DESC",
        _ => return default.to_string(),
    };
    format!("ORDER BY {expr} {dir}, {tiebreak}")
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `cargo test order_clause` (workdir `src-tauri`)
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/domain.rs
git commit -m "feat: helper order_clause com whitelist para sort seguro"
```

---

## Task 2: Sort em `list_transactions`

**Files:**
- Modify: `src-tauri/src/commands/transactions.rs` (linhas 7-13, 15, 37, e teste linha 399)

- [ ] **Step 1: Atualizar o comando e a função `list`**

Substituir o bloco do comando (linhas 7-13):

```rust
#[tauri::command]
pub async fn list_transactions(
    state: State<'_, AppState>,
    month: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<TransactionRow>, String> {
    with_db(&state, |c| list(c, month.as_deref(), sort_by.as_deref(), sort_dir.as_deref()))
}
```

Substituir a assinatura de `list` (linha 15):

```rust
fn list(
    conn: &Connection,
    month: Option<&str>,
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<Vec<TransactionRow>, String> {
```

Substituir a linha 37 (`sql.push_str(" ORDER BY t.date DESC, t.id DESC");`):

> **Nota de correção:** `order_clause` não tem espaço à esquerda e o SQL base de transactions não tem espaço à direita. Usar `format!(" {}", ...)`:

```rust
    sql.push_str(&format!(
        " {}",
        domain::order_clause(
            sort_by,
            sort_dir,
            &[
                ("date", "t.date"),
                ("type", "t.type"),
                ("description", "t.description"),
                ("category", "c.name"),
                ("payment_method", "pm.name"),
                ("amount", "t.amount"),
            ],
            "ORDER BY t.date DESC, t.id DESC",
            "t.id DESC",
        )
    ));
```

- [ ] **Step 2: Atualizar teste existente + adicionar teste de sort**

Na linha 399, atualizar a chamada:

```rust
        let rows = list(&conn, None, None, None).unwrap();
```

Adicionar no fim do `mod tests` de `transactions.rs`:

```rust
#[test]
fn list_transactions_ordena_por_valor() {
    let conn = test_db();
    let pix = add_pm(&conn, "PIX", 1, None);
    for (desc, amount) in [("a", 100), ("c", 300), ("b", 200)] {
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, payment_method_id)
             VALUES (?1, ?2, 2, '2026-06-05', ?3)",
            params![desc, amount, pix],
        )
        .unwrap();
    }
    let rows = list(&conn, None, Some("amount"), Some("asc")).unwrap();
    let amounts: Vec<i64> = rows.iter().map(|r| r.amount).collect();
    assert_eq!(amounts, vec![100, 200, 300]);
}
```

- [ ] **Step 3: Rodar testes**

Run: `cargo test transactions` (workdir `src-tauri`)
Expected: PASS (2 testes do módulo transactions: `list_transactions_ordena_por_valor` e `list_mostra_debito_e_esconde_credito_do_cartao`)

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/transactions.rs
git commit -m "feat: sort por query em list_transactions"
```

---

## Task 3: Sort em `list_categories`

**Files:**
- Modify: `src-tauri/src/commands/categories.rs` (linhas 7-15)

- [ ] **Step 1: Atualizar comando e `list`**

Substituir linhas 7-10:

```rust
#[tauri::command]
pub async fn list_categories(
    state: State<'_, AppState>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<Category>, String> {
    with_db(&state, |c| list(c, sort_by.as_deref(), sort_dir.as_deref()))
}
```

Substituir `fn list(conn: &Connection)` (linha 12) e o prepare (linhas 13-15):

```rust
fn list(
    conn: &Connection,
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<Vec<Category>, String> {
    let order = domain::order_clause(
        sort_by,
        sort_dir,
        &[("name", "name"), ("type", "type"), ("color", "color")],
        "ORDER BY name",
        "id DESC",
    );
    let mut stmt = conn
        .prepare(&format!("SELECT id, name, type, color, icon FROM categories {order}"))
        .map_err(domain::db_err)?;
```

- [ ] **Step 2: Rodar testes**

Run: `cargo test` (workdir `src-tauri`)
Expected: PASS (compila, sem regressão)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/categories.rs
git commit -m "feat: sort por query em list_categories"
```

---

## Task 4: Sort em `list_payment_methods`

**Files:**
- Modify: `src-tauri/src/commands/payment_methods.rs` (linhas 7-15)

- [ ] **Step 1: Atualizar comando e `list`**

Substituir linhas 7-10:

```rust
#[tauri::command]
pub async fn list_payment_methods(
    state: State<'_, AppState>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<PaymentMethod>, String> {
    with_db(&state, |c| list(c, sort_by.as_deref(), sort_dir.as_deref()))
}
```

Substituir `fn list(conn: &Connection)` (linha 12) e o prepare (linhas 13-15):

```rust
fn list(
    conn: &Connection,
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<Vec<PaymentMethod>, String> {
    let order = domain::order_clause(
        sort_by,
        sort_dir,
        &[("name", "name"), ("type", "type")],
        "ORDER BY name",
        "id DESC",
    );
    let mut stmt = conn
        .prepare(&format!("SELECT id, name, type, metadata FROM payment_methods {order}"))
        .map_err(domain::db_err)?;
```

- [ ] **Step 2: Rodar testes**

Run: `cargo test` (workdir `src-tauri`)
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/payment_methods.rs
git commit -m "feat: sort por query em list_payment_methods"
```

---

## Task 5: Sort em `list_fixed_bills`

**Files:**
- Modify: `src-tauri/src/commands/fixed_bills.rs` (linhas 7-29 e teste linha 318)

- [ ] **Step 1: Atualizar comando e `list`**

Substituir linhas 7-13:

```rust
#[tauri::command]
pub async fn list_fixed_bills(
    state: State<'_, AppState>,
    only_installments: bool,
    sort_by: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<FixedBill>, String> {
    with_db(&state, |c| list(c, only_installments, sort_by.as_deref(), sort_dir.as_deref()))
}
```

Substituir `fn list` (linhas 15-29):

```rust
fn list(
    conn: &Connection,
    only_installments: bool,
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<Vec<FixedBill>, String> {
    let (cond, default) = if only_installments {
        ("b.installments IS NOT NULL", "ORDER BY b.start_month DESC, b.id DESC")
    } else {
        ("b.installments IS NULL", "ORDER BY b.start_month ASC, b.id ASC")
    };
    let order = domain::order_clause(
        sort_by,
        sort_dir,
        &[
            ("description", "b.description"),
            ("amount", "b.amount"),
            ("day", "b.day"),
            ("start", "b.start_month"),
            ("end", "b.end_month"),
            ("installments", "b.installments"),
        ],
        default,
        "b.id DESC",
    );
    let sql = format!(
        "SELECT b.id, b.description, b.amount, b.day, b.category_id, c.name,
                b.payment_method_id, pm.name, b.start_month, b.end_month, b.installments, b.purchase_date
         FROM fixed_bills b
         LEFT JOIN categories c ON c.id = b.category_id
         JOIN payment_methods pm ON pm.id = b.payment_method_id
         WHERE {cond}
         {order}"
    );
```

- [ ] **Step 2: Atualizar teste existente**

Linha 318, atualizar a chamada:

```rust
        let rows = list(&conn, true, None, None).unwrap();
```

- [ ] **Step 3: Rodar testes**

Run: `cargo test fixed_bills` (workdir `src-tauri`)
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/fixed_bills.rs
git commit -m "feat: sort por query em list_fixed_bills"
```

---

## Task 6: Sort em `list_loans`

**Files:**
- Modify: `src-tauri/src/commands/loans.rs` (linhas 7-20)

- [ ] **Step 1: Atualizar comando e `list`**

Substituir linhas 7-10:

```rust
#[tauri::command]
pub async fn list_loans(
    state: State<'_, AppState>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<Loan>, String> {
    with_db(&state, |c| list(c, sort_by.as_deref(), sort_dir.as_deref()))
}
```

Substituir `fn list` (linhas 12-20):

```rust
fn list(conn: &Connection, sort_by: Option<&str>, sort_dir: Option<&str>) -> Result<Vec<Loan>, String> {
    let order = domain::order_clause(
        sort_by,
        sort_dir,
        &[
            ("description", "l.description"),
            ("type", "l.type"),
            ("principal", "l.principal"),
            ("installment", "l.installment"),
            ("installments", "l.total_installments"),
            ("start", "l.start_month"),
        ],
        "ORDER BY l.start_month DESC, l.id DESC",
        "l.id DESC",
    );
    let mut stmt = conn
        .prepare(&format!(
            "SELECT l.id, l.type, l.description, l.principal, l.installment,
                    l.total_installments, l.day, l.start_month, l.payment_method_id, pm.name, l.monthly_rate
             FROM loans l JOIN payment_methods pm ON pm.id = l.payment_method_id
             {order}"
        ))
        .map_err(domain::db_err)?;
```

> **Nota:** `end` NÃO entra na whitelist — `loans` não tem coluna `end_month` (getter computado, models.rs:178). Fim fica não-sortable, igual Fechamento/Vencimento.

- [ ] **Step 2: Rodar testes**

Run: `cargo test` (workdir `src-tauri`)
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/loans.rs
git commit -m "feat: sort por query em list_loans"
```

---

## Task 7: Frontend — tipo `Sort` e wrappers em `api.ts`

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/api.ts:17-49`

- [ ] **Step 1: Adicionar tipo `Sort` em `lib/types.ts`**

Adicionar no fim de `lib/types.ts`:

```ts
export interface Sort {
  id: string;
  desc: boolean;
}
```

- [ ] **Step 2: Atualizar wrappers em `lib/api.ts`**

Adicionar `Sort` ao import de `./types` (linhas 2-7) e substituir os 5 wrappers de listagem (linhas 17-18, 27, 34, 39-40, 45):

```ts
import type {
  CardBillDetail, Category, CategoryInput, ChartData, DashboardData, FixedBill, FixedBillInput,
  Loan, LoanDetail, LoanInput, PaymentMethod, PaymentMethodInput, Settings, SettingsInput,
  Sort,
  TransactionInput,
  TransactionRow,
} from "./types";
```

```ts
  listTransactions: (month: string | null, sort: Sort | null = null) =>
    invoke<TransactionRow[]>("list_transactions", {
      month,
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
```

```ts
  listPaymentMethods: (sort: Sort | null = null) =>
    invoke<PaymentMethod[]>("list_payment_methods", {
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
```

```ts
  listCategories: (sort: Sort | null = null) =>
    invoke<Category[]>("list_categories", {
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
```

```ts
  listFixedBills: (onlyInstallments: boolean, sort: Sort | null = null) =>
    invoke<FixedBill[]>("list_fixed_bills", {
      onlyInstallments,
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
```

```ts
  listLoans: (sort: Sort | null = null) =>
    invoke<Loan[]>("list_loans", {
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
```

Observação: Tauri converte `sortBy`/`sortDir` (camelCase) para `sort_by`/`sort_dir` (snake_case) nos comandos Rust — mesmo mecanismo já usado por `onlyInstallments` → `only_installments`.

- [ ] **Step 3: Typecheck**

Run: `bun typecheck`
Expected: sem erros (as chamadas existentes sem arg continuam válidas — param tem default)

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/api.ts
git commit -m "feat: tipo Sort e wrappers de listagem com sort"
```

---

## Task 8: Frontend — `DataTable` com sort controlado

**Files:**
- Modify: `components/crud/DataTable.tsx` (linhas 27-37, 60-75, 110-124)

- [ ] **Step 1: Novas props**

Substituir assinatura e destructuring (linhas 27-37):

```tsx
export function DataTable<T extends { id: number }>({
  columns, rows, selected, onToggle, onRowDoubleClick, loading, rowClass, sort, onSort,
}: {
  columns: Column<T>[];
  rows: T[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onRowDoubleClick?: (row: T) => void;
  loading?: boolean;
  rowClass?: (row: T) => string;
  sort?: Sort | null;
  onSort: (sort: Sort | null) => void;
}) {
```

Adicionar import de `Sort` no topo (junto com `import type { Column } from "./types";`):

```tsx
import type { Column } from "./types";
import type { Sort } from "@/lib/types";
```

- [ ] **Step 2: Corrigir column defs**

Substituir o corpo do loop `for (const c of columns)` (linhas 60-73):

```tsx
    for (const c of columns) {
      defs.push({
        id: c.sortKey ?? c.header,
        enableSorting: !!c.sortKey,
        accessorFn: (row) => (c.sortValue ? c.sortValue(row) : c.render(row)),
        cell: ({ row }) => c.render(row.original),
        meta: { className: c.className },
      });
    }
```

Ajustar o `useMemo` para incluir `sort` nos deps não é necessário — `sort` não é lido dentro do memo. Manter os deps atuais `[columns, rows, selected, onToggle, allChecked]`.

- [ ] **Step 3: Toggle manual no header**

Substituir o bloco do header sortable (linhas 110-124):

```tsx
              {header.column.getCanSort() ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => {
                    const cur = sort;
                    const next = !cur || cur.id !== header.id
                      ? { id: header.id, desc: false }
                      : cur.desc
                        ? null
                        : { id: header.id, desc: true };
                    onSort(next);
                  }}
                >
                  <table.FlexRender header={header} />
                  {sort?.id === header.id ? (
                    sort.desc ? (
                      <ArrowDown className="size-3.5" />
                    ) : (
                      <ArrowUp className="size-3.5" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3.5 opacity-40" />
                  )}
                </button>
              ) : (
                <table.FlexRender header={header} />
              )}
```

Nota: `header.id` = `c.sortKey` (o `id` da column def do passo 2), então `Sort.id` é exatamente a chave da whitelist do backend.

- [ ] **Step 4: Typecheck**

Run: `bun typecheck`
Expected: erro em `CrudPage` (falta passar `sort`/`onSort`) — resolve na Task 9. Se apenas DataTable, ainda terá o erro esperado.

- [ ] **Step 5: Commit**

```bash
git add components/crud/DataTable.tsx
git commit -m "feat: DataTable com sort controlado pelo CrudPage"
```

---

## Task 9: Frontend — `CrudPage` dono do sort

**Files:**
- Modify: `components/crud/CrudPage.tsx` (linhas 4, 16, 28, 72-76, 80-85, 106, 243-251)

- [ ] **Step 1: Tipo do `load` no `CrudConfig`**

Substituir na interface `CrudConfig` (linha 28):

```tsx
  load: (sort: Sort | null) => Promise<T[]>;
```

Adicionar import de `Sort` (junto ao import de types, linha 15):

```tsx
import type { Column, MobileCorners } from "./types";
import type { Sort } from "@/lib/types";
```

Adicionar `keepPreviousData` ao import do react-query (linha 4):

```tsx
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
```

- [ ] **Step 2: Estado de sort + query com sort no key**

Adicionar estado (após linha 70 `const [visibleCount, setVisibleCount] = useState(pageSize);`):

```tsx
  const [sort, setSort] = useState<Sort | null>(null);
  const effectiveKey = [...config.queryKey, sort];
```

Substituir o `rowsQuery` (linhas 72-76):

```tsx
  const rowsQuery = useQuery({
    queryKey: effectiveKey,
    queryFn: () => config.load(sort),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
```

- [ ] **Step 3: `invalidate` com `effectiveKey`**

Substituir o `invalidate` (linhas 80-85):

```tsx
  const invalidate = useCallback(() => {
    void client.invalidateQueries({ queryKey: effectiveKey, exact: true });
    for (const key of config.invalidate ?? []) {
      void client.invalidateQueries({ queryKey: key });
    }
  }, [client, effectiveKey, config.invalidate]);
```

- [ ] **Step 4: Handler de sort**

Adicionar após `const toggle = ...` (linha ~128):

```tsx
  const handleSort = (next: Sort | null) => {
    setSort(next);
    setVisibleCount(pageSize);
  };
```

- [ ] **Step 5: Passar props ao DataTable**

Substituir o `<DataTable>` (linhas 243-251):

```tsx
            <DataTable
              columns={config.columns}
              rows={pageRows}
              selected={selected}
              onToggle={toggle}
              onRowDoubleClick={config.onRowDoubleClick}
              loading={loading}
              rowClass={config.rowClass}
              sort={sort}
              onSort={handleSort}
            />
```

- [ ] **Step 6: Typecheck**

Run: `bun typecheck`
Expected: ainda pode dar erro nas páginas (load com assinatura antiga) — resolve na Task 10.

- [ ] **Step 7: Commit**

```bash
git add components/crud/CrudPage.tsx
git commit -m "feat: CrudPage dono do estado de sort com refetch no banco"
```

---

## Task 10: Frontend — páginas (sortKey + load)

**Files:**
- Modify: `app/transactions/page.tsx:19,25-47`
- Modify: `app/categories/page.tsx:14-21,31`
- Modify: `app/payment-methods/page.tsx:14-27,39`
- Modify: `app/fixed-bills/page.tsx:15-21,30`
- Modify: `app/installments/page.tsx:15-22,31`
- Modify: `app/loans/page.tsx:19-27,36`

- [ ] **Step 1: transactions**

Substituir o `load` (linha 19):

```tsx
  const load = useCallback((sort: Sort | null) => api.listTransactions(month, sort), [month]);
```

Adicionar `Sort` ao import de types (linha 14): `import type { Sort, TransactionInput } from "@/lib/types";`

Adicionar `sortKey` nas colunas (linhas 26, 28, 33, 34, 35, 37):

```tsx
            { header: "Data", sortKey: "date", render: (r) => formatDate(r.date) },
            {
              header: "Tipo",
              sortKey: "type",
              render: (r) => r.is_card_bill ? <Badge>Fatura</Badge>
                : r.type === 1 || r.type === 5 ? <Badge className="bg-positive text-positive-foreground">Receita</Badge>
                : <Badge className="bg-negative text-negative-foreground">Despesa</Badge>,
            },
            { header: "Descrição", sortKey: "description", render: (r) => r.description },
            { header: "Categoria", sortKey: "category", render: (r) => r.category_name ?? "—" },
            { header: "Forma", sortKey: "payment_method", render: (r) => r.payment_method_name ?? "—" },
            {
              header: "Valor",
              sortKey: "amount",
              render: (r) => {
```

- [ ] **Step 2: categories**

Adicionar `sortKey` (linhas 14-21): Cor→`color`, Nome→`name`, Tipo→`type`.

Substituir o `load` (linha 31):

```tsx
        load: api.listCategories,
```

(assinatura `(sort: Sort | null = null) => Promise<Category[]>` já casa com `CrudConfig.load` — sem mudança necessária)

- [ ] **Step 3: payment-methods**

Adicionar `sortKey` nas colunas Nome→`name`, Tipo→`type`. **Não** adicionar em Fechamento/Vencimento.

Substituir o `load` (linha 39): `load: api.listPaymentMethods,` (idem, sem mudança).

- [ ] **Step 4: fixed-bills**

Adicionar `sortKey` (linhas 15-21): Descrição→`description`, Valor→`amount`, Dia→`day`, Início→`start`, Fim→`end`.

Substituir o `load` (linha 30):

```tsx
        load: (sort) => api.listFixedBills(false, sort),
```

- [ ] **Step 5: installments**

Adicionar `sortKey` (linhas 15-22): iguais fixed-bills + Parcelas→`installments`.

Substituir o `load` (linha 31):

```tsx
        load: (sort) => api.listFixedBills(true, sort),
```

- [ ] **Step 6: loans**

Adicionar `sortKey` (linhas 19-27): Descrição→`description`, Tipo→`type`, Valor→`principal`, Parcela→`installment`, Parcelas→`installments`, Início→`start`. **Fim sem sortKey** (`end_month` é computado, não tem coluna no banco).

Substituir o `load` (linha 36): `load: api.listLoans,` (sem mudança necessária).

- [ ] **Step 7: Typecheck**

Run: `bun typecheck`
Expected: sem erros

- [ ] **Step 8: Commit**

```bash
git add app/transactions/page.tsx app/categories/page.tsx app/payment-methods/page.tsx app/fixed-bills/page.tsx app/installments/page.tsx app/loans/page.tsx
git commit -m "feat: sortKey e load com sort nas páginas"
```

---

## Task 11: Verificação final

- [ ] **Step 1: Rodar testes Rust**

Run: `cargo test` (workdir `src-tauri`)
Expected: todos PASS

- [ ] **Step 2: Typecheck + lint**

Run: `bun typecheck && bun lint`
Expected: sem erros

- [ ] **Step 3: Smoke test manual**

Run: `bun tauri dev`
1. Em Transações, clicar header "Valor" → ordem muda (ASC), seta sobe.
2. Clicar de novo → DESC. Clicar de novo → sem seta, volta ordem default (data DESC).
3. Repetir em Categorias, Contas Fixas, Parcelamentos, Empréstimos, Formas de Pagamento.
4. Em Formas de Pagamento, header "Fechamento/Vencimento" não é clicável (sem seta).
5. Ordenar por Valor e editar um registro → lista mantém ordenação após refetch.

---

## Self-Review

**1. Cobertura da spec:**
- Contrato sort (sort_by/sort_dir + whitelist) → Tasks 1-6, 7 ✓
- `order_clause` com fallback default e anti-injection → Task 1 ✓
- Whitelists das 6 telas conforme tabela → Tasks 2-6 ✓
- `Column.sortKey`, header não-clicável sem sortKey → Tasks 8, 10 ✓
- `load` com sort, CrudPage dono do estado → Task 9 ✓
- effectiveKey no queryKey + keepPreviousData → Task 9 ✓
- DataTable corrige accessorKey → accessorFn (bug raiz) → Task 8 ✓
- Testes Rust (order_clause + list_transactions) → Tasks 1-2 ✓
- Busca continua client-side (sem mudança) ✓

**2. Placeholder scan:** nenhum TBD/TODO; código completo em todos os passos.

**3. Consistência de tipos:**
- `Sort { id, desc }` (lib/types.ts) usado em api.ts, DataTable, CrudPage ✓
- Chaves sortKey nos pages = chaves das whitelists Rust ✓
- `order_clause` assinatura idêntica em todas as chamadas (5 args) ✓
- Chamadas de teste atualizadas: `list(&conn, None, None, None)` (Task 2), `list(&conn, true, None, None)` (Task 5) ✓
- `load: api.listCategories` e `load: api.listLoans` continuam válidos (default param) ✓
