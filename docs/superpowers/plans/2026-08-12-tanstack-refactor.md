# Plano: Migração para stack TanStack (Query + Form + Table v9 + Charts)

Fonte: `docs/superpowers/specs/2026-08-12-tanstack-refactor-design.md` (corrigida).

## Objetivo

Trocar a camada de dados/UI por TanStack: `@tanstack/react-query` (dados),
`@tanstack/react-form` v1 (forms), `@tanstack/react-table` v9 (tabela desktop),
`@tanstack/charts` v0.12 (gráficos do dashboard). Remover `recharts`. Novo
comando Rust `get_chart_data`. Manter a abstração `CrudPage` (abordagem A).

## Escopo

- Add deps: `@tanstack/react-query@^5`, `@tanstack/react-form@^1`, `@tanstack/charts@^0.12`. Remover `recharts`. Deletar `components/ui/chart.tsx` (sem imports — confirmar com grep antes).
- `@tanstack/react-table@9` e `zod@^4.4.3` já instalados.
- **Não** usar `@tanstack/zod-form-adapter`: zod v4 é Standard Schema; validar direto com `validators: { onChange: schema }`.
- Backend: `MonthlyPoint`, `ChartData` (models), `expenses_by_category` + `monthly_series` (domain), `commands/chart.rs`, registro em `commands/mod.rs` + `lib.rs`.
- Frontend: `components/providers.tsx` (novo, QueryClientProvider), `lib/schemas.ts`, `lib/forms.ts`, `lib/queries.ts` (novos), `lib/api.ts` (+getChartData), `lib/types.ts` (+MonthlyPoint/ChartData), `app/layout.tsx` (Providers), CrudPage/FormDialog/DataTable/crud/types.ts, 5 forms + novo FieldErrors.tsx, 6 pages, `app/page.tsx` + novo `components/dashboard/ChartSection.tsx`.

Fora de escopo: layout/estilos, LazyTabs, FaturaDetailDialog, PullToRefresh, InfiniteScroll (lógica de scroll), MoneyInput, ToggleGroup, build Android.

## Fatos verificados (não re-pesquisar)

### TanStack Table v9
- `useTable({ features, data, columns })`; `tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() })` de `@tanstack/react-table`. `FEATURES` é const module-scope.
- Coluna: opção é **`sortFn`** (NÃO `sortingFn`). `SortFn = (rowA: Row, rowB: Row, columnId: string) => number`.
- Header: `header.column.toggleSorting()`, `getIsSorted()` → `false | "asc" | "desc"`, `getCanSort()`, `getFirstSortDir()` (default asc).
- Render: `<table.FlexRender header={header} />`, `<table.FlexRender cell={cell} />`. `cell.renderValue()` NÃO chama renderer custom — usar `cell: (info) => ...`.
- Tipo: `ColumnDef<typeof FEATURES, T, unknown>`, `meta` genérico (ler com cast).
- Coluna checkbox manual (seleção externa; sem rowSelectionFeature).
- `table.getFlatHeaders()`, `row.getVisibleCells()`, `row.original`.

### TanStack Form v1
- `useForm({ defaultValues, validators: { onChange: schema }, onSubmit: ({ value }) => mutation.mutate(value) })`.
- `form.Field`/`field.handleChange`/`field.state.meta.errors`/`form.reset(values?)`/`form.Subscribe`.
- `useStore(form.store, (s) => s.values)` re-exportado de `@tanstack/react-form`.
- Erros de schema (nível form) caem nos campos via `path`.
- `CrudFormApi<F> = FormApi<F, any × 11>` (12 params) em `lib/forms.ts`.
- `form.Subscribe selector={(s) => [s.isSubmitting, s.canSubmit, s.isPristine] as const}` funciona (padrão dos docs).
- `mutation` e `form` referenciam-se mutuamente; definir `form` primeiro (onSubmit chama `mutation.mutate` em callback, sem TDZ), `mutation` depois (onSuccess chama `form.reset`).

### TanStack Charts v0.12
- `defineChart({ marks, x, y, color, focus, tooltip })` de `@tanstack/charts`.
- **`fold` é wide→long**: `fold(rows, { fields: ["income","expenses","balance"] as const, as: { key: "series", value: "amount" } })` — entrada = linhas WIDE `data.monthly` DIRETO (que já tem income/expenses/balance); NÃO achatar manualmente. Saída: `{ month, series, amount, source, sourceIndexes }`. Import `@tanstack/charts/transform/fold`.
- `lineY(folded, { x: "month", y: "amount", color: "series", points: true })` (forma de chamada de função).
- `scalePoint<string>()` de `@tanstack/charts/scales/point`, `scaleLinear` de `@tanstack/charts/scales/linear`.
- `focus: "group-x"` (grupo semântico x), `tooltip: { use: tooltip, formatGroup(points) }` de `@tanstack/charts/tooltip`. `points[0].xValue`, `point.groupLabel`, `point.datum`.
- Donut: `pie(rows, { value: "total" })` + `polar({ inset, radiusRatio, marks: [radialArc(slices, { innerRadius: ({ radius }) => radius * 0.58, cornerRadius: 4, color: "name", key: "name" })] })` de `@tanstack/charts/polar`. `color: { domain, range }` top-level. tooltip `format(point)`.
- React: `<Chart definition={...} height={260} ariaLabel="..." />` de `@tanstack/charts/react`.
- Após instalar, conferir assinatura de `fold` na d.ts (`node_modules/@tanstack/charts/dist/transform/fold.d.ts`).

### Backend (confirmado)
- `parse_month(&str) -> Result<NaiveDate, String>`, `month_income(conn, start, end)`, `month_expenses(conn, ref_month)`, `generate_fixed_bills(conn, month)`, `generate_loan_installments(conn, month)`, `refresh_card_bills(conn)`, `sync_generated(conn, now)`, `income_by_category(conn, start, end)`, `expenses_by_pm`, `ensure_card_bills`. `with_db(&state, |c| ...)` + `AppState` de `crate::db`.
- `commands/dashboard.rs` é o template (build + command async).
- Migrations 001-006; `001_init.sql` seed PIX/Boleto. `transactions.type`: 1 receita, 2 despesa, 3 fatura. `bill_start` coluna de card_bills.
- Testes: `Connection::open_in_memory()` + `migrations().to_latest(&mut c)`.

## Riscos / atenções
- **typecheck quebrado entre tasks 6 e 7**: CrudPage/FormDialog mudam assinatura; 5 páginas antigas compilam só na task 7. Aceito pelo plano.
- Next 16 tem docs próprias em `node_modules/next/dist/docs/` (regra AGENTS.md) — conferir `01-app/01-getting-started/05-server-and-client-components.md` antes de mexer em layout/providers (task 2).
- Lint `react-hooks/set-state-in-effect` bloqueia setState em useEffect — side-effects via `form.setFieldValue` em useEffect com `eslint-disable`.
- `refresh()` (CrudPage) precisa resetar search + lote explicitamente nos handlers (lição: nunca via useEffect).
- long-press/select-none em cards touch não afetado (DataTable é desktop).

---

## Tarefas

### T1 — Dependências
- `bun add @tanstack/react-query @tanstack/react-form @tanstack/charts`; `bun remove recharts`.
- Grep por imports de `recharts` e `components/ui/chart`; deletar `components/ui/chart.tsx`.
- Verificar na d.ts instalada a assinatura de `fold` e de `ChartTooltipContentContext` (formatGroup/format).
- Commit: `chore: adiciona dependências TanStack`.

### T2 — Providers + layout
- Ler `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` (regra AGENTS.md).
- `components/providers.tsx` ("use client"):
```tsx
"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      })
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
```
- `app/layout.tsx`: montar `<Providers>` por fora do `<MonthProvider>` (ThemeProvider → Providers → MonthProvider → children).
- Commit: `feat: adiciona QueryClientProvider`.

### T3 — Backend Rust
- `src-tauri/src/models.rs` (adicionar):
```rust
#[derive(Debug, Clone, Serialize)]
pub struct MonthlyPoint {
    pub month: String,
    pub income: i64,
    pub expenses: i64,
    pub balance: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChartData {
    pub monthly: Vec<MonthlyPoint>,
    pub expenses_by_cat: Vec<BreakdownRow>,
}
```
- `src-tauri/src/domain.rs` (adicionar, espelhando `income_by_category`):
```rust
/// Despesas por categoria no período (type = 2; faturas type = 3 ficam de fora).
pub fn expenses_by_category(
    conn: &Connection,
    start: NaiveDate,
    end: NaiveDate,
) -> Result<Vec<crate::models::BreakdownRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT COALESCE(c.name, 'Sem categoria') AS name, SUM(t.amount) AS total
             FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
             WHERE t.type = 2 AND t.date >= ?1 AND t.date < ?2
             GROUP BY c.name ORDER BY total DESC",
        )
        .map_err(db_err)?;
    let rows = stmt
        .query_map(
            rusqlite::params![
                start.format("%Y-%m-%d").to_string(),
                end.format("%Y-%m-%d").to_string()
            ],
            |r| {
                Ok(crate::models::BreakdownRow {
                    name: r.get(0)?,
                    total: r.get(1)?,
                })
            },
        )
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(rows)
}

/// Série de `months` meses terminando em `ref_month`; saldo acumula desde zero.
pub fn monthly_series(
    conn: &Connection,
    ref_month: NaiveDate,
    months: u32,
) -> Result<Vec<crate::models::MonthlyPoint>, String> {
    let mut out = Vec::with_capacity(months as usize);
    let mut balance = 0;
    for k in (0..months).rev() {
        let m = ref_month.checked_sub_months(Months::new(k)).unwrap();
        let next = m.checked_add_months(Months::new(1)).unwrap();
        let income = month_income(conn, m, next)?;
        let expenses = month_expenses(conn, m)?;
        balance += income - expenses;
        out.push(crate::models::MonthlyPoint {
            month: m.format("%Y-%m").to_string(),
            income,
            expenses,
            balance,
        });
    }
    Ok(out)
}
```
- `src-tauri/src/commands/chart.rs` (novo, template = dashboard.rs):
```rust
use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::ChartData;
use chrono::Months;
use tauri::State;

fn build(conn: &rusqlite::Connection, month: &str) -> Result<ChartData, String> {
    let ref_month = domain::parse_month(month)?;
    domain::generate_fixed_bills(conn, ref_month)?;
    domain::generate_loan_installments(conn, ref_month)?;
    domain::refresh_card_bills(conn)?;
    let next = ref_month.checked_add_months(Months::new(1)).unwrap();
    Ok(ChartData {
        monthly: domain::monthly_series(conn, ref_month, 12)?,
        expenses_by_cat: domain::expenses_by_category(conn, ref_month, next)?,
    })
}

#[tauri::command]
pub async fn get_chart_data(state: State<'_, AppState>, month: String) -> Result<ChartData, String> {
    let now = chrono::Local::now().date_naive();
    with_db(&state, |c| {
        domain::sync_generated(c, now)?;
        build(c, &month)
    })
}
```
- `commands/mod.rs`: `pub mod chart;`. `lib.rs`: adicionar `commands::chart::get_chart_data` em `invoke_handler`.
- `src-tauri/tests/chart_data_test.rs` (novo, padrão do repo):
```rust
use ajudafinancas_lib::db::migrations;
use ajudafinancas_lib::domain;
use chrono::NaiveDate;
use rusqlite::Connection;

fn conn() -> Connection {
    let mut c = Connection::open_in_memory().unwrap();
    migrations().to_latest(&mut c).unwrap();
    c
}

fn add_pm(c: &Connection, name: &str) -> i64 {
    c.execute(
        "INSERT INTO payment_methods (name, type, metadata) VALUES (?1, 1, NULL)",
        [name],
    )
    .unwrap();
    c.last_insert_rowid()
}

fn add_tx(c: &Connection, desc: &str, amount: i64, ty: i64, date: &str, pm_id: Option<i64>) {
    c.execute(
        "INSERT INTO transactions (description, amount, type, date, payment_method_id)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![desc, amount, ty, date, pm_id],
    )
    .unwrap();
}

#[test]
fn monthly_series_acumula_saldo_desde_zero() {
    let c = conn();
    let pix = add_pm(&c, "PIX");
    add_tx(&c, "salario", 100000, 1, "2026-04-05", None);
    add_tx(&c, "mercado", 40000, 2, "2026-04-10", Some(pix));
    add_tx(&c, "freela", 50000, 1, "2026-05-05", None);
    add_tx(&c, "contas", 30000, 2, "2026-05-10", Some(pix));

    let series =
        domain::monthly_series(&c, NaiveDate::from_ymd_opt(2026, 5, 1).unwrap(), 3).unwrap();
    assert_eq!(series.len(), 3);
    assert_eq!(series[0].month, "2026-03");
    assert_eq!(series[0].balance, 0);
    assert_eq!(series[1].month, "2026-04");
    assert_eq!(series[1].balance, 60000);
    assert_eq!(series[2].month, "2026-05");
    assert_eq!(series[2].balance, 80000);
}

#[test]
fn expenses_by_category_agrupa_e_ignora_receitas() {
    let c = conn();
    let pix = add_pm(&c, "PIX");
    c.execute(
        "INSERT INTO categories (name, type, color) VALUES ('Alimentação', 2, '#ef4444')",
        [],
    )
    .unwrap();
    let cat = c.last_insert_rowid();
    add_tx(&c, "mercado", 5000, 2, "2026-06-03", Some(pix));
    add_tx(&c, "lanche", 3000, 1, "2026-06-05", None);
    c.execute(
        "INSERT INTO transactions (description, amount, type, date, category_id)
         VALUES ('uber', 2000, 2, '2026-06-06', ?1)",
        [cat],
    )
    .unwrap();
    add_tx(&c, "avulsa", 3000, 2, "2026-06-07", Some(pix));

    let rows = domain::expenses_by_category(
        &c,
        NaiveDate::from_ymd_opt(2026, 6, 1).unwrap(),
        NaiveDate::from_ymd_opt(2026, 7, 1).unwrap(),
    )
    .unwrap();
    let totais: std::collections::HashMap<_, _> =
        rows.iter().map(|r| (r.name.as_str(), r.total)).collect();
    assert_eq!(totais.get("Alimentação"), Some(&2000));
    assert_eq!(totais.get("Sem categoria"), Some(&8000));
    assert_eq!(totais.len(), 2);
}
```
- Verificar: `cargo test --manifest-path src-tauri/Cargo.toml`.
- Commit: `feat: adiciona get_chart_data e série mensal`.

### T4 — libs TS (schemas, forms, queries, api, types)
- `lib/types.ts`: adicionar `MonthlyPoint` e `ChartData` (espelhar Rust; `BreakdownRow` já existe).
- `lib/api.ts`: adicionar
```ts
export async function getChartData(month: string | null): Promise<ChartData> {
  return invoke<ChartData>("get_chart_data", { month })
}
```
- `lib/forms.ts`:
```ts
import type { FormApi } from "@tanstack/react-form"

export type CrudFormApi<F> = FormApi<F, any, any, any, any, any, any, any, any, any, any, any>

export { useStore } from "@tanstack/react-form"
```
- `lib/schemas.ts` (zod v4; saída EXATA = tipos de `lib/types.ts`):
```ts
import { z } from "zod"

export const transactionSchema = z
  .object({
    description: z.string().min(1, "Informe a descrição"),
    amount: z.number().positive("Informe o valor"),
    type: z.union([z.literal(1), z.literal(2)], { error: "Selecione o tipo" }),
    date: z.string().min(1, "Informe a data"),
    category_id: z.number().nullable(),
    payment_method_id: z.number().nullable(),
    card_mode: z.union([z.literal(0), z.literal(1)]),
  })
  .refine((v) => v.type !== 2 || v.payment_method_id != null, {
    message: "Selecione a forma de pagamento",
    path: ["payment_method_id"],
  })

export const fixedBillSchema = z
  .object({
    description: z.string().min(1, "Informe a descrição"),
    amount: z.number().positive("Informe o valor"),
    day: z.number().min(1, "Dia entre 1 e 31").max(31, "Dia entre 1 e 31"),
    category_id: z.number().nullable(),
    payment_method_id: z.number("Selecione a forma de pagamento"),
    start_month: z.string().min(1, "Informe o mês inicial"),
    end_month: z.string().nullable(),
    installments: z.number().min(2, "Mínimo de 2 parcelas").nullable(),
    purchase_date: z.string().nullable(),
  })
  .refine((v) => v.end_month === null || v.end_month >= v.start_month, {
    message: "O mês final deve ser após o inicial",
    path: ["end_month"],
  })

export const loanSchema = z
  .object({
    type: z.union([z.literal(1), z.literal(2)], { error: "Selecione o tipo" }),
    description: z.string().min(1, "Informe a descrição"),
    principal: z.number().positive("Informe o valor total"),
    installment: z.number().positive("Informe o valor da parcela"),
    total_installments: z.number().min(2, "Mínimo de 2 parcelas"),
    day: z.number().min(1, "Dia entre 1 e 31").max(31, "Dia entre 1 e 31"),
    start_month: z.string().min(1, "Informe o mês inicial"),
    payment_method_id: z.number("Selecione a forma de pagamento"),
    monthly_rate: z.number().min(0, "Taxa entre 0 e 0,99").max(0.99, "Taxa entre 0 e 0,99"),
  })
  .refine((v) => v.installment * v.total_installments >= v.principal, {
    message: "O total das parcelas deve cobrir o valor",
    path: ["installment"],
  })

export const paymentMethodSchema = z
  .object({
    name: z.string().min(1, "Informe o nome"),
    type: z.union([z.literal(1), z.literal(2)], { error: "Selecione o tipo" }),
    close_day: z.number().nullable(),
    validity_day: z.number().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 2) {
      if (v.close_day == null)
        ctx.addIssue({ code: "custom", message: "Informe o dia de fechamento", path: ["close_day"] })
      if (v.validity_day == null)
        ctx.addIssue({ code: "custom", message: "Informe o dia de vencimento", path: ["validity_day"] })
    }
  })

export const categorySchema = z.object({
  name: z.string().min(1, "Informe o nome"),
  type: z.union([z.literal(1), z.literal(2)], { error: "Selecione o tipo" }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
  icon: z.string().nullable(),
})
```
- `lib/queries.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as api from "./api"
import type { DashboardData } from "./types"

export const queryKeys = {
  dashboard: (month: string | null) => ["dashboard", month] as const,
  chart: (month: string | null) => ["chart-data", month] as const,
  transactions: (month: string | null) => ["transactions", month] as const,
  categories: ["categories"] as const,
  paymentMethods: ["payment-methods"] as const,
  fixedBills: (finished: boolean) => ["fixed-bills", finished] as const,
  loans: ["loans"] as const,
}

export function useDashboard(month: string | null) {
  return useQuery({ queryKey: queryKeys.dashboard(month), queryFn: () => api.getDashboard(month) })
}

export function useChartData(month: string | null) {
  return useQuery({ queryKey: queryKeys.chart(month), queryFn: () => api.getChartData(month) })
}

export function useSyncDashboard() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.syncDashboard(),
    onSuccess: () => {
      // ponytail: DB global único; invalidar tudo é simples e suficiente.
      void client.invalidateQueries()
    },
  })
}
```
- Commit: `feat: adiciona schemas zod e hooks TanStack Query`.

### T5 — DataTable v9 (props antigas; verde isolado)
Manter props atuais (`rows` = página já filtrada/sliceada), trocar internos para v9. Sort roda dentro da página atual (≤25 linhas).

- `crud/types.ts`: `Column<T>` ganha `sortValue?: (row: T) => string | number`.
- `components/crud/DataTable.tsx`:
```tsx
"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import {
  ColumnDef,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import type { Column } from "./types"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const FEATURES = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
})

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  selected: Set<number>
  onToggle: (id: number, checked: boolean) => void
  onRowDoubleClick?: (row: T) => void
  loading?: boolean
  rowClass?: (row: T) => string | undefined
}

export function DataTable<T extends { id: number }>({
  columns,
  rows,
  selected,
  onToggle,
  onRowDoubleClick,
  loading,
  rowClass,
}: DataTableProps<T>) {
  const columnDefs = React.useMemo<ColumnDef<typeof FEATURES, T, unknown>[]>(() => {
    const defs: ColumnDef<typeof FEATURES, T, unknown>[] = [
      {
        id: "select",
        enableSorting: false,
        header: () => null,
        meta: { className: "w-10" },
        cell: ({ row }) => (
          <Checkbox
            checked={selected.has(row.original.id)}
            onCheckedChange={(v) => onToggle(row.original.id, v === true)}
            aria-label="Selecionar linha"
          />
        ),
      },
    ]
    for (const c of columns) {
      defs.push({
        id: c.header,
        accessorKey: c.header,
        sortFn: (rowA, rowB) => {
          const a = c.sortValue ? c.sortValue(rowA.original) : c.render(rowA.original)
          const b = c.sortValue ? c.sortValue(rowB.original) : c.render(rowB.original)
          if (typeof a === "number" && typeof b === "number") return a - b
          return String(a).toLowerCase().localeCompare(String(b).toLowerCase(), "pt-BR")
        },
        cell: ({ row }) => c.render(row.original),
        meta: { className: c.className },
      })
    }
    return defs
  }, [columns, selected, onToggle])

  const table = useTable({ features: FEATURES, data: rows, columns: columnDefs })
  const visibleRows = table.getRowModel().rows

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {table.getFlatHeaders().map((header) => (
            <TableHead
              key={header.id}
              className={cn(
                header.column.columnDef.enableSorting && "cursor-pointer select-none",
                (header.column.columnDef.meta as { className?: string } | undefined)?.className
              )}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1"
                onClick={() => header.column.getCanSort() && header.column.toggleSorting()}
              >
                <table.FlexRender header={header} />
                {header.column.getCanSort() &&
                  (header.column.getIsSorted() === "asc" ? (
                    <ArrowUp className="size-3.5" />
                  ) : header.column.getIsSorted() === "desc" ? (
                    <ArrowDown className="size-3.5" />
                  ) : (
                    <ArrowUpDown className="size-3.5 opacity-40" />
                  ))}
              </button>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading && rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length + 1} className="h-24 text-center">
              <Spinner />
            </TableCell>
          </TableRow>
        ) : visibleRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length + 1} className="h-24 text-center text-muted-foreground">
              Nenhum registro encontrado.
            </TableCell>
          </TableRow>
        ) : (
          visibleRows.map((row) => (
            <TableRow
              key={row.original.id}
              data-state={selected.has(row.original.id) ? "selected" : undefined}
              onDoubleClick={() => onRowDoubleClick?.(row.original)}
              className={rowClass?.(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    (cell.column.columnDef.meta as { className?: string } | undefined)?.className
                  )}
                >
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
```
- Verificar: `bun run typecheck`.
- Commit: `feat: migra DataTable para TanStack Table v9`.

### T6 — CrudPage + FormDialog + types + page Transações (typecheck QUEBRADO até T7)
- `crud/types.ts`: adicionar `CrudConfig` + `DialogState`:
```ts
import type { ComponentType } from "react"
import type { CrudFormApi } from "@/lib/forms"
import type { Column } from "./types"

export interface CrudConfig<T extends { id: number }, F, E> {
  title: string
  empty: () => F
  toInput: (row: T) => F
  queryKey: unknown[]
  invalidate?: unknown[][]
  load: () => Promise<T[]>
  schema: ZodType<F>
  queryResources?: () => Promise<E>
  create: (input: F) => Promise<T>
  update: (id: number, input: F) => Promise<T>
  remove: (ids: number[]) => Promise<void>
  FormFields: ComponentType<{ form: CrudFormApi<F>; resources: E; serverError: string | null }>
  columns: Column<T>[]
  pageSize?: number
  keepOpenOnCreate?: boolean
  rowClass?: (row: T) => string | undefined
}

export interface DialogState<F> {
  mode: "create" | "edit"
  input: F
  id?: number
}
```
- `components/crud/FormDialog.tsx` (rewrite):
```tsx
"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "@tanstack/react-form"
import type { CrudConfig, DialogState } from "./types"
import type { CrudFormApi } from "@/lib/forms"
import { msg } from "@/lib/api"
import { Spinner } from "@/components/ui/spinner"
import { FieldError } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface FormDialogProps<F, E> {
  config: CrudConfig<F, E>
  dialog: DialogState<F> | null
  onClose: () => void
}

export function FormDialog<F, E>({ config, dialog, onClose }: FormDialogProps<F, E>) {
  const client = useQueryClient()
  const form = useForm({
    defaultValues: dialog?.input ?? config.empty(),
    validators: { onChange: config.schema },
    onSubmit: ({ value }) => mutation.mutate(value),
  })

  const mutation = useMutation({
    mutationFn: (input: F) =>
      dialog?.mode === "edit" && dialog.id != null
        ? config.update(dialog.id, input)
        : config.create(input),
    onSuccess: () => {
      for (const key of config.invalidate ?? []) void client.invalidateQueries({ queryKey: key })
      if (dialog?.mode === "create" && config.keepOpenOnCreate) form.reset(config.empty())
      else onClose()
    },
  })

  const serverError = mutation.isError ? msg(mutation.error) : null

  const resourcesQuery = useQuery({
    queryKey: [...config.queryKey, "resources"],
    queryFn: config.queryResources!,
    enabled: config.queryResources != null,
  })

  return (
    <Dialog open={dialog != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={form.handleSubmit}>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Editar" : "Novo"} {config.title.slice(0, -1)}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {config.queryResources ? (
              resourcesQuery.isLoading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : resourcesQuery.isError ? (
                <FieldError>{msg(resourcesQuery.error)}</FieldError>
              ) : (
                <config.FormFields
                  form={form as unknown as CrudFormApi<F>}
                  resources={resourcesQuery.data as E}
                  serverError={serverError}
                />
              )
            ) : (
              <config.FormFields
                form={form as unknown as CrudFormApi<F>}
                resources={undefined as E}
                serverError={serverError}
              />
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <form.Subscribe selector={(s) => [s.isSubmitting, s.canSubmit, s.isPristine] as const}>
              {([isSubmitting, canSubmit, isPristine]) => (
                <Button type="submit" disabled={!canSubmit || isPristine} loading={isSubmitting}>
                  Salvar
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```
Nota: `config.update` precisa ser `(id: number, input: F) => Promise<T>` — nas pages, wrap de `api.updateX(id, input)`.

- `components/forms/FieldErrors.tsx` (novo):
```tsx
import { FieldError } from "@/components/ui/field"

export function FieldErrors({ errors }: { errors: unknown[] }) {
  const items = errors
    .filter(Boolean)
    .map((e) => (typeof e === "string" ? { message: e } : e))
    .filter((e): e is { message?: string } => typeof e === "object" && "message" in (e as object))
  if (items.length === 0) return null
  return (
    <>
      {items.map((e, i) => (
        <FieldError key={i}>{e.message}</FieldError>
      ))}
    </>
  )
}
```
- `components/crud/CrudPage.tsx` (rewrite; reusa seleção/dialog/confirm/search/infinite-scroll atuais):
```tsx
"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, RefreshCw, Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CrudConfig, DialogState } from "./types"
import { msg } from "@/lib/api"
import { DataTable } from "./DataTable"
import { FormDialog } from "./FormDialog"
import { PullToRefresh } from "../PullToRefresh"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"

export function CrudPage<T extends { id: number }, F, E>({ config }: { config: CrudConfig<T, F, E> }) {
  const client = useQueryClient()
  const pageSize = config.pageSize ?? 25

  const [query, setQuery] = useState("")
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirm, setConfirm] = useState(false)
  const [dialog, setDialog] = useState<DialogState<F> | null>(null)

  const rowsQuery = useQuery({ queryKey: config.queryKey, queryFn: config.load, staleTime: 15_000 })

  const refresh = useCallback(async () => {
    setQuery("")
    setVisibleCount(pageSize)
    setSelected(new Set())
    await rowsQuery.refetch()
  }, [pageSize, rowsQuery.refetch])

  const filtered = useMemo(() => {
    const rows = rowsQuery.data ?? []
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      Object.values(r as unknown as Record<string, unknown>).some(
        (v) => v != null && String(v).toLowerCase().includes(q)
      )
    )
  }, [rowsQuery.data, query])

  const handleToggle = useCallback((id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev)
        if (checked) for (const r of filtered) next.add(r.id)
        else for (const r of filtered) next.delete(r.id)
        return next
      })
    },
    [filtered]
  )

  const removeMutation = useMutation({
    mutationFn: () => config.remove([...selected]),
    onSuccess: () => {
      setSelected(new Set())
      setConfirm(false)
      for (const key of config.invalidate ?? []) void client.invalidateQueries({ queryKey: key })
      toast.success("Registros removidos")
    },
    onError: (e) => toast.error(msg(e)),
  })

  const openDialog = useCallback(
    (mode: "create" | "edit", input: F, id?: number) => setDialog({ mode, input, id }),
    []
  )

  const dialogKey = dialog ? (dialog.mode === "create" ? "create" : `edit-${dialog.id ?? "unknown"}`) : "closed"

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount((v) => v + pageSize)
      },
      { rootMargin: "200px" }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [pageSize])

  if (rowsQuery.isError && !rowsQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-muted-foreground">Falha ao carregar os dados</p>
        <Button variant="outline" onClick={() => rowsQuery.refetch()}>Tentar novamente</Button>
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={() => refresh()} className="...">
      <div className="flex items-center justify-between gap-3 pb-4">
        <h1 className="text-xl font-semibold">{config.title}</h1>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-48"
          />
          <Button size="sm" variant="ghost" onClick={() => refresh()} title="Atualizar" aria-label="Atualizar">
            <RefreshCw className={cn("size-4", rowsQuery.isFetching && "animate-spin")} />
          </Button>
          {selected.size > 0 && (
            <Button size="sm" variant="destructive" onClick={() => setConfirm(true)}>
              <Trash2 className="size-4" /> ({selected.size})
            </Button>
          )}
          <Button size="sm" onClick={() => openDialog("create", config.empty())}>
            <Plus className="size-4" /> Novo
          </Button>
        </div>
      </div>

      <DataTable
        columns={config.columns}
        rows={filtered.slice(0, visibleCount)}
        selected={selected}
        onToggle={handleToggle}
        onRowDoubleClick={(row) => openDialog("edit", config.toInput(row), row.id)}
        loading={rowsQuery.isFetching}
        rowClass={config.rowClass}
      />

      <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
        <span>Mostrando {Math.min(visibleCount, filtered.length)} de {filtered.length}</span>
        <Button size="sm" variant="ghost" onClick={toggleAll}>
          {selected.size > 0 ? "Limpar" : "Selecionar todos"}
        </Button>
      </div>
      <div ref={sentinelRef} className="h-px" />

      <FormDialog key={dialogKey} config={config} dialog={dialog} onClose={() => setDialog(null)} />

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selected.size} registro(s)?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeMutation.mutate()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PullToRefresh>
  )
}
```
Nota: `toggleAll` para "Selecionar todos" — no estado antigo o allChecked vivia no DataTable; agora o botão fica no rodapé. `rows` do DataTable aqui = `filtered.slice(0, visibleCount)` (mesmo comportamento atual); sort dentro da janela. Se preferir sort global, passar `filtered` inteiro + prop `visibleCount` no DataTable e slicear pós-sort — manter como está (janela) é o comportamento atual, sem custo.

- Page Transações (`app/transactions/page.tsx`): config com `queryKey: queryKeys.transactions(month)`, `invalidate: [queryKeys.dashboard(month), ["card-bill"]]`, `keepOpenOnCreate: true`, `queryResources` (categories + paymentMethods via `Promise.all`), `schema: transactionSchema`, `columns` com `sortValue` em Data (`r.date`) e Valor (`r.amount`), FaturaDetailDialog preservado.
- `components/forms/TransactionForm.tsx`: rewrite com `form.Field`/`FieldErrors`/`useStore`. Lógica de tipo/payment method/card_mode idêntica à atual, via `form.setFieldValue`.
- Commit: `feat: migra CrudPage/FormDialog para TanStack Query/Form`.

### T7 — Forms + pages restantes (typecheck VERDE)
- Rewrite de `FixedBillForm`, `LoanForm`, `CategoryForm`, `PaymentMethodForm` no padrão da T6. Reutilizar `calculateMonthlyRate`/`deriveRate` existentes no LoanForm (auto-derivar via `useState` `auto` local + `useEffect` + `form.setFieldValue("monthly_rate", ...)` + eslint-disable). Toggle "Indefinida"/"Até uma data" no end_month; limpar `purchase_date` quando pm não é cartão; PM/categoria: trocar type para padrão limpa close_day/validity_day.
- Pages fixed-bills (`["fixed-bills", false]`), installments (`["fixed-bills", true]`), loans, categories, payment-methods: configs completos (queryKey/invalidate per tabela do spec), `sortValue` onde faz sentido (Parcelas `r.paid_count`, Valor `r.amount`, Parcela `r.installment`).
- `bun run typecheck` verde.
- Commit: `feat: migra formulários restantes para TanStack Form`.

### T8 — Dashboard + ChartSection
- `components/dashboard/ChartSection.tsx` (novo):
```tsx
"use client"

import * as React from "react"
import { defineChart, lineY } from "@tanstack/charts"
import { fold } from "@tanstack/charts/transform/fold"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { scalePoint } from "@tanstack/charts/scales/point"
import { Chart } from "@tanstack/charts/react"
import { tooltip } from "@tanstack/charts/tooltip"
import { pie, polar, radialArc } from "@tanstack/charts/polar"
import type { ChartData } from "@/lib/types"
import { formatMoney, formatMonth } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const TREND_COLORS = { income: "#22c55e", expenses: "#ef4444", balance: "#6366f1" }
const TREND_LABEL = { income: "Receitas", expenses: "Despesas", balance: "Saldo" } as const
// ponytail: backend não expõe cor por categoria; paleta fixa cicla por índice.
const DONUT_COLORS = [
  "#0ea5e9", "#6366f1", "#a855f7", "#ec4899", "#f97316", "#14b8a6",
  "#84cc16", "#f43f5e", "#06b6d4", "#8b5cf6",
]

export function ChartSection({ data }: { data: ChartData }) {
  const folded = React.useMemo(
    () =>
      fold(data.monthly, {
        fields: ["income", "expenses", "balance"] as const,
        as: { key: "series", value: "amount" },
      }),
    [data.monthly]
  )

  const trend = React.useMemo(
    () =>
      defineChart({
        marks: [lineY(folded, { x: "month", y: "amount", color: "series", points: true })],
        x: {
          scale: () => scalePoint<string>().padding(0.2),
          axis: { ticks: { format: (v) => formatMonth(String(v)) } },
        },
        y: {
          scale: scaleLinear(),
          nice: true,
          grid: true,
          axis: { ticks: { format: (v) => formatMoney(Number(v)) } },
        },
        focus: "group-x",
        tooltip: {
          use: tooltip,
          formatGroup: (points) => {
            const heading = formatMonth(String(points[0]?.xValue ?? ""))
            return [
              heading,
              ...points.map(
                (p) => `${TREND_LABEL[p.datum.series as keyof typeof TREND_LABEL] ?? p.groupLabel}: ${formatMoney(Number(p.datum.amount))}`
              ),
            ].join("\n")
          },
        },
        color: { domain: Object.keys(TREND_COLORS), range: Object.values(TREND_COLORS) },
      }),
    [folded]
  )

  const donut = React.useMemo(() => {
    const rows = data.expenses_by_cat.map((r) => ({ name: r.name, total: r.total }))
    const slices = pie(rows, { value: "total" })
    return defineChart({
      marks: [
        polar({
          inset: 8,
          radiusRatio: 0.82,
          marks: [
            radialArc(slices, {
              innerRadius: ({ radius }) => radius * 0.58,
              cornerRadius: 4,
              color: "name",
              key: "name",
            }),
          ],
        }),
      ],
      color: {
        domain: rows.map((r) => r.name),
        range: rows.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length]),
      },
      tooltip: {
        use: tooltip,
        format: (point) => `${point.datum.name}: ${formatMoney(Number(point.datum.total))}`,
      },
    })
  }, [data.expenses_by_cat])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Evolução</CardTitle></CardHeader>
        <CardContent>
          <Chart definition={trend} height={260} ariaLabel="Evolução mensal de receitas, despesas e saldo" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Despesas por categoria</CardTitle></CardHeader>
        <CardContent>
          {data.expenses_by_cat.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem despesas no mês.</p>
          ) : (
            <>
              <Chart definition={donut} height={220} ariaLabel="Despesas por categoria" />
              <ul className="mt-3 space-y-1 text-sm">
                {data.expenses_by_cat.map((r, i) => (
                  <li key={r.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                      />
                      {r.name}
                    </span>
                    <span className="text-muted-foreground">{formatMoney(r.total)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```
Nota: `TREND_LABEL` usa `balance` (key da série fold = nome do campo). Se `formatGroup`/`format` tiparem `datum` genericamente, usar casts (verificado na d.ts na T1).

- `app/page.tsx` (dashboard): usar `useMonth`, `useDashboard(month)`, `useSyncDashboard` + `doSync` (mutateAsync + toasts), `ChartSection(data)` quando houver dados; loading/erro com retry; layout dos cards mantido.
- Remover import de `recharts` e do antigo state manual.
- Verificação visual: `bun tauri dev` (charts renderizam, tooltip em group-x, donut com legendas).
- Commit: `feat: adiciona gráficos ao dashboard`.

### T9 — Verificação final + commit
- `bun run typecheck && bun run lint && bun run build`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `git status`/diff; commit:
  `refactor: migra para stack TanStack (Query+Form+Table+Charts)`

## Notas ponytail
- `invalidateQueries()` global no sync (DB único).
- Paleta fixa do donut (backend sem cor por categoria).
- Sort dentro da janela visível (pageRows) — comportamento atual, sem custo extra.
- `FieldErrors` sem generics de FieldApi.

## Fora de escopo / adiar
- Build Android (fluxo AGENTS.md) — não mudou nada nativo além de um comando Tauri.
- Testes de UI/componentes — nenhum framework no repo.
