# Rebuild do AjudaFinancas em Tauri — Design

Data: 2026-08-04
Status: aprovado

## Objetivo

Reconstruir o app de finanças pessoais `AjudaFinancas` (hoje Go + GORM + SQLite +
htmx + daisyUI + Alpine em webview) como app desktop Tauri v2 + Next.js +
shadcn/ui. Funcionalidades 1:1, banco novo (começar do zero).

## Stack

- **Scaffold**: `bunx create-tauri-ui@latest` (framework **Next.js**). Batteries
  inclusas: theme-provider shadcn (dark/light), debug panel (Ctrl/Cmd+D),
  sem startup flash, external links no browser, release workflow GitHub Actions.
- **Frontend**: Next.js 15 App Router, `output: 'export'` (static). Tailwind 4 +
  shadcn/ui (dialog, sonner toast, table, button, form, select, checkbox,
  dropdown-menu). Sem htmx, sem Alpine, sem daisyUI. `@tauri-apps/api` `invoke`.
- **Backend**: Rust, rusqlite + rusqlite_migration. DB em `app_data_dir`.
  Comandos Tauri `#[tauri::command]` por domínio.
- **Update**: `tauri-plugin-updater` (check no startup, modal, apply+restart).
  Releases assinados + GitHub Actions workflow do template.
- **Month picker**: dropdown-menu shadcn (grade de 12 meses + ano), sem lib externa.

## Banco de dados (migration 1)

Schema espelha o GORM atual. Valores monetários em centavos (`i64`).

- `payment_methods`: id, name, type (1=standard, 2=card), metadata JSON
  (`{close_day, validity_day}` p/ cartão)
- `categories`: id, name, type (1=receita, 2=despesa), color (hex), icon
- `transactions`: id, description, amount, type (1=receita, 2=despesa),
  date, category_id?, payment_method_id?, fixed_bill_id?, loan_id?
- `fixed_bills`: id, description, amount, day, category_id?, payment_method_id,
  start_month, end_month?, installments?
- `loans`: id, type (1=emprestimo, 2=financiamento), description, principal,
  installment, total_installments, day, start_month, payment_method_id

Seed: payment methods PIX e Boleto se tabela vazia.

## Lógica de negócio em Rust (porta direta, com testes unit)

- `GenerateFixedBills(month)`: gera transações de contas fixas ativas no mês
  (day clamped ao último dia), skip se já existe transação p/ fixed_bill_id.
- `GenerateLoanInstallments(month)`: gera parcela (despesa) mensal e entrada
  (receita, empréstimos) única no start_month. Skip se já gerada.
- `SyncGenerated`: limpa transações geradas órfãs (contas fixas/empréstimos
  excluídos) e regenera.
- `Loan`: `MonthlyRate` (bisseção na fórmula PV = PMT·(1-(1+i)^-n)/i),
  `Schedule` (tabela SAC), `TotalPaid`, `TotalInterest`, `EndMonth`.
- `billingPeriod(closeDay, refMonth)`: período de fatura do cartão.
- Dashboard: `monthIncome`, `monthExpenses` (billing period por cartão),
  breakdown por categoria (receita) e por forma de pagamento (despesa),
  saldo (atual + mês anterior), earliest month.
- Validações por modelo (descrição, valor>0, dia 1-31, forma de pagamento
  obrigatória p/ despesa/contas/loans, fim > início, parcelas >= 2,
  total das parcelas >= principal, etc).

## Frontend — telas

- **Layout**: sidebar (Dashboard, Transações, Formas de Pagamento, Categorias,
  Contas Fixas, Parcelamentos, Financiamentos/Empréstimos) + theme toggle +
  month picker global + versão.
- **Dashboard**: stats (receita, despesas, saldo) + breakdown receita por
  categoria e despesa por forma de pagamento. Filtro mês.
- **Transações**: lista paginada (25/pág) com filtro mês, checkbox seleção,
  CRUD em modal (form com keep-open p/ criação).
- **Formas de Pagamento**: lista + CRUD; cartão tem close_day/validity_day.
- **Categorias**: lista + CRUD; cor + ícone.
- **Contas Fixas**: lista (inclusive parcelamentos >= 2 parcelas) + CRUD.
- **Parcelamentos**: visão de contas fixas com installments.
- **Empréstimos**: lista + CRUD + detail com tabela de amortização.
- Delete com confirmação (multi-seleção aceita `ids`).

## Distribuição

- `tauri build`: AppImage/deb (Linux), .msi (Windows).
- Workflow GitHub Actions do template p/ releases; updater config com pubkey.
- Assinatura: `tauri signer` p/ gerar par de chaves.

## Fora do escopo

- Migração de dados do DB Go antigo (começa do zero).
- Plataformas mobile.
- Backend HTTP / API.
- CI além do workflow de release do template.

## Ambiente

- Precisa instalar: rustup + cargo, bun.
