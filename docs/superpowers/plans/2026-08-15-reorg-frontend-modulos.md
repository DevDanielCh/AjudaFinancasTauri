# Reorganização Frontend em Módulos + Nomenclatura de Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organizar o frontend em `src/<Modulo>/{Models,Repositories,Services,Views}` (TODO #4) e padronizar a nomenclatura dos forms como `<Entidade>AddForm` / `<Entidade>EditForm` / `<Entidade>ViewForm` (TODO #5). As páginas do App Router ficam em `app/` como Controllers finos.

**Architecture:** Dois módulos: `src/OrganizacaoFinanceira/` (transações, categorias, formas de pagamento, contas fixas, financiamentos) e `src/Investimentos/` (reserva). Cross-cutting (Sort, Dashboard, Settings, hooks globais, format/utils/schemas/forms API, UI) permanece em `src/shared/` e `lib/`/`components/`. Páginas `app/*/page.tsx` continuam as rotas e importam dos módulos.

**Tech Stack:** Next.js App Router, TypeScript, @tanstack/react-query, zod. Alias `@/*` → raiz do projeto (tsconfig `paths`), logo imports novos são `@/src/<Modulo>/...`.

**Convenções:**
1. Movimento verbatim — conteúdo copia integral; muda caminho e imports.
2. Nomes de entidade em português SEM acento nos arquivos: `Transacao`, `Categoria`, `FormaPagamento`, `ContaFixa`, `Financiamento`, `Reserva`.
3. `AddForm` = campos reais (content do form atual). `EditForm` = wrapper fino reutilizando `AddForm`. `ViewForm` = leitura (move componentes de detalhe existentes; demais ficam read-only simples, wiring de visualização genérica fica para depois — fora de escopo).
4. Cada task termina com `bun run typecheck` e `bun run lint` verdes.

## Estado-alvo

```
src/
  OrganizacaoFinanceira/
    Models/  transaction.ts  category.ts  payment-method.ts  fixed-bill.ts  loan.ts
    Repositories/  transaction.ts  category.ts  payment-method.ts  fixed-bill.ts  loan.ts
    Services/  transaction.ts  category.ts  payment-method.ts  fixed-bill.ts  loan.ts
    Views/
      Transacao/    TransacaoAddForm.tsx  TransacaoEditForm.tsx  TransacaoViewForm.tsx
      Categoria/    CategoriaAddForm.tsx  CategoriaEditForm.tsx  CategoriaViewForm.tsx
      FormaPagamento/  FormaPagamentoAddForm.tsx  FormaPagamentoEditForm.tsx  FormaPagamentoViewForm.tsx
      ContaFixa/    ContaFixaAddForm.tsx  ContaFixaEditForm.tsx  ContaFixaViewForm.tsx
      Financiamento/  FinanciamentoAddForm.tsx  FinanciamentoEditForm.tsx  FinanciamentoViewForm.tsx
  Investimentos/
    Models/  reserva.ts
    Repositories/  reserva.ts
    Services/  reserva.ts
    Views/Reserva/  ReservaAddForm.tsx  ReservaEditForm.tsx  ReservaViewForm.tsx
  shared/
    models.ts     Sort, DashboardData, ChartData, BreakdownRow, MonthlyPoint, Settings, SettingsInput
    repository.ts getEarliestMonth, getVersion, getSettings, updateSettings,
                  getDashboard, syncDashboard, getChartData, msg
    services.ts   dashboardKeys, chartKeys, settingsKeys, earliestMonthKeys,
                  useDashboard, useChartData, useSyncDashboard, useSettings, useUpdateSettings
```

Fica fora (infra compartilhada, não move): `lib/format.ts`, `lib/utils.ts`, `lib/forms.ts`, `lib/schemas.ts`, `lib/month-context.tsx`, `lib/use-is-mobile.ts`, `components/ui/*`, `components/crud/*`, `components/forms/MoneyInput.tsx`, `components/forms/FieldErrors.tsx`, `components/DatePicker.tsx`, `components/MonthPicker.tsx`, `components/Sidebar.tsx`, `components/BottomBar.tsx`, `components/PullToRefresh.tsx`, `components/providers.tsx`, `components/theme-provider.tsx`, `components/MobileHeader.tsx`, `components/UpdateDialog.tsx`.

## Mapa de origem

| Origem | Destino |
|---|---|
| `lib/types.ts` (entidades) | `src/OrganizacaoFinanceira/Models/*.ts` + `src/Investimentos/Models/reserva.ts` |
| `lib/types.ts` (Sort, DashboardData, ChartData, Settings) | `src/shared/models.ts` |
| `lib/api.ts` (fns por entidade) | `src/<Modulo>/Repositories/<entidade>.ts`; `msg` e fns globais → `src/shared/repository.ts` |
| `lib/queries.ts` (queryKeys por entidade) | `src/<Modulo>/Services/<entidade>.ts`; hooks globais → `src/shared/services.ts` |
| `components/forms/TransactionForm.tsx` | `src/OrganizacaoFinanceira/Views/Transacao/TransacaoAddForm.tsx` |
| `components/forms/CategoryForm.tsx` | `src/OrganizacaoFinanceira/Views/Categoria/CategoriaAddForm.tsx` |
| `components/forms/PaymentMethodForm.tsx` | `src/OrganizacaoFinanceira/Views/FormaPagamento/FormaPagamentoAddForm.tsx` |
| `components/forms/FixedBillForm.tsx` | `src/OrganizacaoFinanceira/Views/ContaFixa/ContaFixaAddForm.tsx` |
| `components/forms/LoanForm.tsx` | `src/OrganizacaoFinanceira/Views/Financiamento/FinanciamentoAddForm.tsx` |
| `components/forms/ReservaForm.tsx` | `src/Investimentos/Views/Reserva/ReservaAddForm.tsx` |
| `components/transactions/FaturaDetailDialog.tsx` | `src/OrganizacaoFinanceira/Views/Transacao/TransacaoViewForm.tsx` |
| `components/loans/DetailDialog.tsx` | `src/OrganizacaoFinanceira/Views/Financiamento/FinanciamentoViewForm.tsx` |
| `app/*/page.tsx` | importações trocadas para os módulos |

---

### Task 1: Models

- [ ] **Step 1: Criar Models de OrganizacaoFinanceira**

Criar `src/OrganizacaoFinanceira/Models/transaction.ts`:
```ts
export interface TransactionRow {
  id: number;
  description: string;
  amount: number;
  type: number;
  date: string;
  category_id: number | null;
  category_name: string | null;
  payment_method_id: number | null;
  payment_method_name: string | null;
  card_mode: number;
  is_card_bill: boolean;
}

export interface TransactionInput {
  description: string;
  amount: number;
  type: number;
  date: string;
  category_id: number | null;
  payment_method_id: number | null;
  card_mode: number;
}

export interface CardBillDetail {
  id: number;
  description: string;
  amount: number;
  type: number;
  date: string;
  category_id: number | null;
  category_name: string | null;
  payment_method_id: number | null;
  payment_method_name: string | null;
  card_mode: number;
  is_card_bill: boolean;
  purchases: TransactionRow[];
}
```
(Conferir os campos exatos de `TransactionRow`/`CardBillDetail` em `lib/types.ts` e copiar fielmente — o acima é o esqueleto; o conteúdo real prevalece.)

Criar `category.ts`, `payment-method.ts`, `fixed-bill.ts`, `loan.ts` movendo verbatim de `lib/types.ts`: `Category`, `CategoryInput`, `PaymentMethod`, `PaymentMethodInput`, `FixedBill`, `FixedBillInput`, `Loan`, `LoanInput`, `LoanDetail`. Criar `src/Investimentos/Models/reserva.ts`:
```ts
import type { TransactionRow, TransactionInput } from "@/src/OrganizacaoFinanceira/Models/transaction";

export type ReservaRow = TransactionRow;
export interface ReservaInput {
  description: string;
  amount: number;
  type: number;
  date: string;
}
```
(conferir `ReservaInput` usado em `app/reserva/page.tsx`: `{ description, amount, type, date }`.)

Criar `src/shared/models.ts` com `Sort`, `DashboardData`, `ChartData`, `BreakdownRow`, `MonthlyPoint`, `Settings`, `SettingsInput` (verbatim de `lib/types.ts`).

- [ ] **Step 2: Remover de lib/types.ts**

Deletar `lib/types.ts`. Ajustar imports em `lib/api.ts`, `lib/queries.ts`, `app/*/page.tsx` e qualquer outro — como essas dependências são reescritas nas Tasks 2-5, deixar o `typecheck` para o final da Task 5 (executar `bun run typecheck` e corrigir acumulado, ou executar por página conforme for editando).

- [ ] **Step 3: Commit**

```bash
git add src/ lib/types.ts
git commit -m "refactor: Models por módulo no frontend"
```

---

### Task 2: Repositories

- [ ] **Step 1: Criar Repositories de OrganizacaoFinanceira**

`src/OrganizacaoFinanceira/Repositories/transaction.ts` (verbatim de `lib/api.ts`, trocando imports de tipos):
```ts
import { invoke } from "@tauri-apps/api/core";
import type { Sort } from "@/src/shared/models";
import type { CardBillDetail, TransactionInput, TransactionRow } from "../Models/transaction";

export const transactionApi = {
  list: (month: string | null, sort: Sort | null = null) =>
    invoke<TransactionRow[]>("list_transactions", {
      month,
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
  create: (input: TransactionInput) => invoke<void>("create_transaction", { input }),
  update: (id: number, input: TransactionInput) =>
    invoke<void>("update_transaction", { id, input }),
  remove: (ids: number[]) => invoke<void>("delete_transactions", { ids }),
  getCardBill: (id: number) => invoke<CardBillDetail>("get_card_bill", { id }),
};
```
Idem para `category.ts`, `payment-method.ts`, `fixed-bill.ts` (com `onlyInstallments: boolean` no `list`), `loan.ts` (com `getDetail`). `src/Investimentos/Repositories/reserva.ts`:
```ts
import { invoke } from "@tauri-apps/api/core";
import type { ReservaRow } from "../Models/reserva";

export const reservaApi = {
  listMovements: () => invoke<ReservaRow[]>("list_reserva_movements"),
};
```

- [ ] **Step 2: Criar shared/repository.ts**

`src/shared/repository.ts` (verbatim de `lib/api.ts` fns globais):
```ts
import { invoke } from "@tauri-apps/api/core";
import type {
  ChartData, DashboardData, Settings, SettingsInput,
} from "./models";

export const sharedApi = {
  getEarliestMonth: () => invoke<string>("get_earliest_month"),
  getVersion: () => invoke<string>("get_version"),
  getSettings: () => invoke<Settings>("get_settings"),
  updateSettings: (input: SettingsInput) => invoke<void>("update_settings", { input }),
  getDashboard: (month: string) => invoke<DashboardData>("get_dashboard", { month }),
  syncDashboard: (month: string) => invoke<DashboardData>("sync_dashboard", { month }),
  getChartData: (month: string | null) => invoke<ChartData>("get_chart_data", { month }),
};

export function msg(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : "Erro desconhecido";
}
```

- [ ] **Step 3: Deletar lib/api.ts**

Deletar `lib/api.ts` (Task 5 corrige os usos de `api.` e `msg`).

- [ ] **Step 4: Commit**

```bash
git add src/ lib/api.ts
git commit -m "refactor: Repositories por módulo no frontend"
```

---

### Task 3: Services

- [ ] **Step 1: Criar Services por módulo**

Cada arquivo exporta as query keys da entidade (hoje o frontend não tem hooks por entidade — a camada de Service é fina e cresce quando houver hooks; YAGNI):

`src/OrganizacaoFinanceira/Services/transaction.ts`:
```ts
export const transactionKeys = (month: string | null) => ["transactions", month] as const;
```
`category.ts`: `export const categoryKeys = ["categories"] as const;`
`payment-method.ts`: `export const paymentMethodKeys = ["payment-methods"] as const;`
`fixed-bill.ts`: `export const fixedBillKeys = (finished: boolean) => ["fixed-bills", finished] as const;`
`loan.ts`: `export const loanKeys = ["loans"] as const;`
`src/Investimentos/Services/reserva.ts`: `export const reservaKeys = ["reserva"] as const;`

- [ ] **Step 2: Criar shared/services.ts**

`src/shared/services.ts` (verbatim de `lib/queries.ts` hooks + keys compartilhadas):
```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { sharedApi } from "./repository";
import type { SettingsInput } from "./models";

export const dashboardKeys = (month: string | null) => ["dashboard", month] as const;
export const chartKeys = (month: string | null) => ["chart-data", month] as const;
export const settingsKeys = ["settings"] as const;
export const earliestMonthKeys = ["earliest-month"] as const;

export function useDashboard(month: string | null) {
  return useQuery({
    queryKey: dashboardKeys(month),
    queryFn: () => sharedApi.getDashboard(month ?? ""),
  });
}

export function useChartData(month: string | null) {
  return useQuery({
    queryKey: chartKeys(month),
    queryFn: () => sharedApi.getChartData(month),
  });
}

export function useSyncDashboard(month: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => sharedApi.syncDashboard(month),
    onSuccess: () => {
      // ponytail: DB global único; invalidar tudo é simples e suficiente.
      void client.invalidateQueries();
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys,
    queryFn: () => sharedApi.getSettings(),
    staleTime: 15_000,
  });
}

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsInput) => sharedApi.updateSettings(input),
    onSuccess: () => {
      // ponytail: DB global único; invalidar tudo é simples e suficiente.
      void client.invalidateQueries();
    },
  });
}
```

- [ ] **Step 3: Deletar lib/queries.ts**

Deletar `lib/queries.ts` (Task 5 corrige usos de `queryKeys`/`use*`).

- [ ] **Step 4: Commit**

```bash
git add src/ lib/queries.ts
git commit -m "refactor: Services por módulo no frontend"
```

---

### Task 4: Views — AddForm, EditForm, ViewForm

- [ ] **Step 1: Mover AddForms**

Mover verbatim de `components/forms/` para `src/<Modulo>/Views/<Entidade>/<Entidade>AddForm.tsx` (6 arquivos), trocando imports de tipos:
- `@/lib/types` → `../../Models/...` relativo ao arquivo (ou `@/src/...`)
- `@/lib/api` (se usado) → não usado em forms
Mover `components/loans/DetailDialog.tsx` → `src/OrganizacaoFinanceira/Views/Financiamento/FinanciamentoViewForm.tsx` e `components/transactions/FaturaDetailDialog.tsx` → `src/OrganizacaoFinanceira/Views/Transacao/TransacaoViewForm.tsx`, ajustando imports de `@/lib/types`/`@/lib/api`.

- [ ] **Step 2: Criar EditForms (wrappers)**

`src/OrganizacaoFinanceira/Views/Transacao/TransacaoEditForm.tsx`:
```tsx
"use client";
import type { Category, PaymentMethod } from "../../Models/category";
import type { PaymentMethod as PM } from "../../Models/payment-method";
import type { TransactionInput } from "../../Models/transaction";
import type { CrudFormApi } from "@/lib/forms";
import { TransacaoAddForm } from "./TransacaoAddForm";

export function TransacaoEditForm({
  form,
  resources,
  serverError,
}: {
  form: CrudFormApi<TransactionInput>;
  resources: { categories: Category[]; paymentMethods: PM[] } | undefined;
  serverError: string | null;
}) {
  return <TransacaoAddForm form={form} resources={resources} serverError={serverError} />;
}
```
Idem (mesmo padrão, tipos do modelo da entidade) para `CategoriaEditForm`, `FormaPagamentoEditForm`, `ContaFixaEditForm`, `FinanciamentoEditForm`, `ReservaEditForm`. Conferir a prop `resources` de cada form atual e reproduzir o tipo exato.

- [ ] **Step 3: Criar ViewForms read-only**

Para `Categoria`, `FormaPagamento`, `ContaFixa` e `Reserva`, criar ViewForm read-only simples (o fluxo de "Visualizar" genérico é fora de escopo; o componente fica pronto):
```tsx
"use client";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { formatDate, formatMoney } from "@/lib/format";
import type { TransactionRow } from "../../Models/transaction";

export function ReservaViewForm({ row }: { row: TransactionRow }) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Descrição</FieldLabel>
        <div className="text-sm">{row.description}</div>
      </Field>
      <Field>
        <FieldLabel>Valor</FieldLabel>
        <div className="text-sm font-mono">{formatMoney(row.amount)}</div>
      </Field>
      <Field>
        <FieldLabel>Data</FieldLabel>
        <div className="text-sm">{formatDate(row.date)}</div>
      </Field>
    </FieldGroup>
  );
}
```
Ajustar modelo/tipos por entidade (ex.: Categoria mostra `name`).

- [ ] **Step 4: Deletar components/forms movidos**

Deletar os 6 forms de `components/forms/`, `components/loans/`, `components/transactions/` (remover arquivos e referências obsoletas, ex.: `components/forms/MoneyInput.tsx` e `FieldErrors.tsx` permanecem pois são usados pelos AddForms).

- [ ] **Step 5: Verificação**

Run: `bun run typecheck`
Expected: erros de import pendentes nas páginas (corrigidos na Task 5) — anotar quais, mas não precisa resolver já.

- [ ] **Step 6: Commit**

```bash
git add src/ components/forms components/loans components/transactions
git commit -m "refactor: Views por módulo com Add/Edit/View forms"
```

---

### Task 5: Controllers (app/) — atualizar imports

- [ ] **Step 1: Atualizar páginas**

Para cada página em `app/`, trocar imports:

`app/transactions/page.tsx`:
```tsx
import { transactionApi } from "@/src/OrganizacaoFinanceira/Repositories/transaction";
import { transactionKeys } from "@/src/OrganizacaoFinanceira/Services/transaction";
import { TransacaoAddForm } from "@/src/OrganizacaoFinanceira/Views/Transacao/TransacaoAddForm";
import { TransacaoViewForm } from "@/src/OrganizacaoFinanceira/Views/Transacao/TransacaoViewForm";
import { dashboardKeys, chartKeys } from "@/src/shared/services";
import type { Sort, TransactionInput } from "@/src/OrganizacaoFinanceira/Models/transaction";
```
Substituições:
- `api.listTransactions(month, sort)` → `transactionApi.list(month, sort)`
- `api.createTransaction` → `transactionApi.create`
- `api.updateTransaction` → `transactionApi.update`
- `api.deleteTransactions` → `transactionApi.remove`
- `api.listCategories()` / `api.listPaymentMethods()` → `categoryApi.list()` / `paymentMethodApi.list()`
- `queryKeys.transactions(month)` → `transactionKeys(month)`; `queryKeys.dashboard(month)` → `dashboardKeys(month)`
- `queryKeys.chart(null)` → `chartKeys(null)`
- `FaturaDetailDialog` → `TransacaoViewForm` (mesma prop `{ id, onClose }`)
- `TransactionForm` → `TransacaoAddForm`

`app/reserva/page.tsx` → módulo Investimentos: `reservaApi.listMovements()`, `reservaKeys`, `ReservaAddForm`, `dashboardKeys/chartKeys/transactionKeys` nos invalidates, tipos de `src/Investimentos/Models/reserva` e `src/OrganizacaoFinanceira/Models/transaction`.

`app/categories/page.tsx`, `app/payment-methods/page.tsx`, `app/fixed-bills/page.tsx`, `app/installments/page.tsx`, `app/loans/page.tsx` → análogos com `categoryApi`/`paymentMethodApi`/`fixedBillApi`/`loanApi`, `categoryKeys`/`paymentMethodKeys`/`fixedBillKeys`/`loanKeys`, `CategoriaAddForm`/`FormaPagamentoAddForm`/`ContaFixaAddForm`/`FinanciamentoAddForm` e `FinanciamentoViewForm` (no lugar de `DetailDialog`).

`app/page.tsx` e `app/configuracoes/page.tsx` → `src/shared/services` (`useDashboard`, `useChartData`, `useSyncDashboard`, `useSettings`, `useUpdateSettings`) e `src/shared/models` (tipos).

- [ ] **Step 2: Corrigir imports remanescentes**

`rtk grep -rn "@/lib/api\|@/lib/queries\|@/lib/types" app components src` → cada match:
- `msg` → `@/src/shared/repository`
- hooks/keys → `@/src/shared/services` ou módulo
- tipos → `@/src/<Modulo>/Models/...` ou `@/src/shared/models`

- [ ] **Step 3: Verificação completa**

Run: `bun run typecheck` e `bun run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app components src
git commit -m "refactor: controllers (app/) importando dos módulos"
```

---

### Task 6: Self-review

- [ ] **Step 1: Checklist da spec**

- [ ] `src/<Modulo>/{Models,Repositories,Services,Views}` por módulo (TODO #4)
- [ ] Forms nomeados `<Entidade>AddForm|EditForm|ViewForm` (TODO #5)
- [ ] Mesma organização aplicada a backend (plano `reorg-backend-modulos`) e frontend
- [ ] Nenhuma referência a `lib/types`, `lib/api`, `lib/queries` sobrou:
  Run: `rtk grep -rn "@/lib/types\|@/lib/api\|@/lib/queries" app components src`
  Expected: nenhum match.

- [ ] **Step 2: Build**

Run: `bun run build`
Expected: limpo.

- [ ] **Step 3: Teste manual rápido**

Run: `bun run dev`
- Abrir cada página; CRUD adicionar/editar/excluir funciona
- Dashboard e Configurações carregam
- Menu mobile (BottomBar) e desktop (Sidebar) navegam
