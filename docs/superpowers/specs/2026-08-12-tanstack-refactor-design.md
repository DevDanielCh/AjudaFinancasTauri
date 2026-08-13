# Design — Refactor TanStack no Ajuda Finanças

Data: 2026-08-12
Status: aprovado (2026-08-12)

## Objetivo

Adotar a stack TanStack em todo o app: **Query** (dados), **Form** (formulários),
**Table** (tabelas desktop) e **Charts** (gráficos do dashboard). Hoje o fetch é
manual (`useState`/`useEffect` em `CrudPage`, dashboard e `FormDialog`), os forms
são controlados à mão sem validação client (zod instalado e não usado),
`@tanstack/react-table@9` está instalado porém nunca importado, e não existe
nenhum gráfico (recharts/shadcn wrapper sem uso).

## Estado atual (2026-08-12)

- Fetch: `useState`/`useEffect` em `components/crud/CrudPage.tsx`,
  `app/page.tsx` (dashboard) e `components/crud/FormDialog.tsx`
  (`loadResources`).
- Forms: componentes controlados recebendo `value`/`onChange`; validação só no
  Rust (`validate()` em `models.rs`).
- Table: `components/crud/DataTable.tsx` com `<table>` cru e config
  `Column<T>` (`header` + `render`).
- Charts: nenhum. `components/ui/chart.tsx` (wrapper recharts) não usado.
- Backend: SQLite via comandos Tauri em `src-tauri/src/commands/*`. Dashboard:
  `dashboard.rs` retorna só o mês atual (`DashboardData`). Existe
  `income_by_category` mas **não** `expenses_by_category`.

## Escopo (aprovado)

- TanStack Query + Form + Table + Charts.
- Abordagem A: `CrudPage` continua o motor genérico, refactor interno.
- Table desktop ganha **sorting** por clique no header.
- Charts: **linhas** (receita/despesa/saldo dos últimos 12 meses; desvio do
  "bar" do rascunho porque barra agrupada não é documentada na API v0.12) +
  **donut** (despesa por categoria **do mês selecionado**) no dashboard.
- Aceito o risco de `@tanstack/charts` v0.x (pré-1.0).

## 1. Dependências

| Ação | Pacote | Nota |
|---|---|---|
| add | `@tanstack/react-query@^5` | fetch/cache/mutação |
| add | `@tanstack/react-form@^1` | formulários |
| add | `@tanstack/charts` | gráficos (adapter React via `@tanstack/charts/react`) |
| skip | `@tanstack/zod-form-adapter` | não necessário: zod v4 é Standard Schema e funciona direto em `validators` |
| keep | `@tanstack/react-table@^9` | passa a ser usado de fato |
| keep | `zod` | já instalado, vira validador dos forms |
| remove | `recharts` + `components/ui/chart.tsx` | nunca usado |

## 2. Camada de dados

### QueryClient
- Novo `components/providers.tsx` com `QueryClientProvider`.
- Config: `staleTime: 30_000`, `refetchOnWindowFocus: false` (app desktop),
  `retry: 1`.
- Montado no `app/layout.tsx` (pode coexistir com providers existentes).

### Query keys (centralizadas em `lib/queries.ts`)
- `["transactions", month]`
- `["categories"]`
- `["payment-methods"]`
- `["fixed-bills", onlyInstallments]`
- `["loans"]`
- `["dashboard", month]`
- `["card-bill", id]`
- `["earliest-month"]`

### Hooks
- `useTransactions(month)`, `useCategories()`, `usePaymentMethods()`,
  `useFixedBills(onlyInstallments)`, `useLoans()`, `useDashboard(month)`,
  `useCardBill(id)`, `useEarliestMonth()`.
- Mutações: `useCreateTransaction`, `useUpdateTransaction`,
  `useDeleteTransactions`, e análogas para categories, payment-methods,
  fixed-bills, loans. Cada `onSuccess` invalida as chaves dependentes:
  - transações → `["transactions", *]`, `["dashboard", *]`, `["card-bill", *]`
  - fixed-bills → `["fixed-bills", *]`, `["transactions", *]`, `["dashboard", *]`
  - categories/payment-methods → chave própria + `["transactions", *]`
    (mostram `category_name`/`payment_method_name`)
  - loans → `["loans"]`, `["transactions", *]`, `["dashboard", *]`
- `lib/api.ts` (`invoke` puro) permanece; os hooks chamam ele.

## 3. CrudPage (refactor interno)

- `CrudConfig` ganha `queryKey: unknown[]`, substitui `reloadKey`.
- Interno:
  - `useQuery({ queryKey, queryFn: config.load })` no lugar de `rows`/`reload()`.
    `isLoading` vira o `loading` atual; refetch alimenta `PullToRefresh`.
  - `useMutation` para create/update/remove; `onSuccess` invalida a queryKey.
  - `FormDialog` recebe a mutation apropriada e os recursos (abaixo).
- O que **fica como está**: search/filtro client-side, infinite scroll
  (`IntersectionObserver`), seleção de linhas, `CardOptionsSheet`,
  `ConfirmDialog`, `CardList` mobile, `DataTable` desktop.
- Configs das páginas: só trocam `reloadKey: month` por
  `queryKey: ["transactions", month]` etc.

## 4. Formulários (TanStack Form + zod)

- `lib/schemas.ts`: schemas zod por entidade (`transactionSchema`,
  `fixedBillSchema`, `loanSchema`, `paymentMethodSchema`, `categorySchema`),
  espelhando a validação do Rust em `models.rs`. Primeira validação client-side
  do app.
- `FormDialog` usa `useForm({ defaultValues: empty()|toInput(row), validators:
  { onChange: schema }, onSubmit })`; `onSubmit` chama a mutation e trata
  erro → `msg(e)` no campo de erro.
- Components de form (`TransactionForm`, `FixedBillForm`, `LoanForm`,
  `PaymentMethodForm`, `CategoryForm`) passam a receber `form` em vez de
  `value`/`onChange`. Campos via `form.Field` + `form.Subscribe` (padrão
  TanStack Form).
- `MoneyInput` ganha ponte para o form (valor numérico `number`, mantém máscara).
- `loadResources` vira `useQuery` com chave derivada
  (ex.: `["transaction-resources"]`), disparada quando o dialog abre.

## 5. Table (TanStack Table v9)

- `DataTable` internamente usa `useReactTable`.
- Colunas geradas do `Column<T>` existente:
  - `id: c.header`, `header: c.header`, `cell: ({ row }) => c.render(row.original)`
  - Sorting custom: `sortingFn` compara `String(c.render(a.original)).toLowerCase()`
    com o mesmo texto da coluna `b` (usa a saída exibida, pois `render` é a
    única fonte de valor hoje).
- **Sorting**: clique no header alterna asc/desc; indicador visual
  (lucide `ArrowUpDown`/`ArrowUp`/`ArrowDown`).
- Seleção por checkbox e duplo-clique preservados (campos `rowSelection` são
  controlados de fora, como hoje).
- `CardList` mobile **não** usa TanStack Table (não é tabela) — intacto.

## 6. Dashboard + Charts

### Frontend (`app/page.tsx`)
- `useQuery({ queryKey: ["dashboard", month] })` substitui o `useEffect`+`load`.
- "Sincronizar" vira `useMutation(api.syncDashboard)` com `setQueryData` no
  `onSuccess`; estado `syncing` derivado de `mutation.isPending`.
- Novo componente `components/dashboard/ChartSection.tsx`:
  - **Bar**: receita/despesa/saldo por mês (série dos últimos 12 meses).
  - **Donut**: despesa por categoria do mês selecionado.
  - Dados via `useQuery({ queryKey: ["chart-data", month] })`.
- Datas na UI no formato DD-MM-YYYY (`formatDate`), inclusive tooltip dos
  gráficos (mês vira `MM-YYYY` via `formatMonth`, helper que **já existe** em
  `lib/format.ts`).

### Backend (Rust)
- `models.rs`: `MonthlyPoint { month: String, income: i64, expenses: i64,
  balance: i64 }` e `ChartData { monthly: Vec<MonthlyPoint>,
  expenses_by_cat: Vec<BreakdownRow> }`.
- `domain.rs`: `expenses_by_category(conn, start, end)` — espelho de
  `income_by_category` com `type = 2` (só pagamentos diretos; `type = 3`
  faturas já é contado via `refresh_card_bills` nas despesas do mês da fatura).
- `commands/chart.rs`: comando `get_chart_data(state, month)`:
  - gera/atualiza contas (reusa `dashboard::build` — ou extrai a rotina de
    geração para um helper compartilhado);
  - `monthly_series(conn, ref_month, 12)`: loop de 12 meses para trás, saldo
    acumulado partindo de zero;
  - `balance` = saldo acumulado mês a mês;
  - `expenses_by_cat` do mês selecionado.
- Registrar em `commands/mod.rs` e `lib.rs`.

## 7. Error handling

- `useQuery.error` → estado de erro com botão "Tentar novamente" (retry)
  no `CrudPage` e no dashboard.
- Mutações → `toast.add({ title: msg(e), type: "error" })` (helper `msg` de
  `lib/api.ts` já existe).
- Validação client → erro inline no form via `form.state.errors`.

## 8. Testes

- Rust: novo `tests/chart_data_test.rs` cobrindo `get_chart_data` (série de 12
  meses + `expenses_by_cat` do mês). Rodar `cargo test --manifest-path
  src-tauri/Cargo.toml`.
- Frontend: `bun run typecheck`, `bun run lint`, `bun run build`.
- Nada de framework de teste frontend novo (YAGNI; o app não tem).

## Fora de escopo (explícito)

- TanStack Router/Start (manter Next.js + export estático Tauri).
- TanStack Virtual (lista já tem infinite scroll satisfatório).
- Migração das configs de página (só a troca `reloadKey` → `queryKey`).
- `components/ui/chart.tsx` e recharts são removidos por serem código morto.
