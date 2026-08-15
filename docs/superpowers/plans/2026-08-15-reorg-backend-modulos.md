# Reorganização Backend em Módulos (Tauri/Rust) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quebrar `src-tauri/src/{models.rs,domain.rs,commands/}` em módulos por domínio — `shared/` (util, settings, card bills, relatórios), `organizacao_financeira/` (transações, categorias, formas de pagamento, contas fixas, financiamentos) e `investimentos/` (reserva) — cada módulo com `models.rs`, `repository.rs`, `service.rs`, `controller.rs`.

**Architecture:** Cada módulo: `mod.rs` (barrel `pub use`), `models.rs`, `repository.rs` (SQL de leitura), `service.rs` (validação + regras + write), `controller.rs` (fns `#[tauri::command]`). Cross-cutting (relatórios, settings, cartões, util) ficam em `shared/`. Estado final: `domain.rs` e `commands/` deletados.

**Tech Stack:** Rust, Tauri v2, rusqlite, migrations SQL embutidas.

**Convenções (CRÍTICAS para o executor):**
1. **Movimento é verbatim** — conteúdo de função/símbolo copia integral; muda apenas o caminho do arquivo e os `use`/paths (`crate::models::X` → `crate::organizacao_financeira::models::X`, etc.).
2. **Visibilidade:** helper que era `fn privado` e passa a ser usado por outro módulo vira `pub(crate) fn`. Se o compilador acusar `function is private`, tornar `pub(crate)` (não `pub`) a menos que o `controller` o use via `#[tauri::command]`.
3. **Testes movem com o código** que testam. Helpers de teste (`test_db`, `add_tx`, `add_pm`) moram em `shared/mod.rs` sob `#[cfg(test)]` como `pub(crate)`. Módulos os usam via `use crate::shared::{test_db, add_tx, add_pm}` dentro de `mod tests`.
4. **Cada task termina com `cargo test` verde** em `src-tauri/`. Se falhar por visibilidade, corrija com a regra 2. Nunca siga para a próxima task com vermelho.

## Estado-alvo

```
src-tauri/src/
  lib.rs  main.rs  db.rs          (db.rs inalterado)
  shared/
    mod.rs                         barrel + cfg(test) helpers
    util.rs                        parse_month, month_range, month_diff, db_err,
                                   order_clause, current_month, add_months,
                                   month_str_to_date, get_earliest_month, get_version
    settings.rs                    Settings, SettingsInput, get_settings, set_settings,
                                   earliest_month, earliest_tx_month, validate,
                                   get_settings/update_settings (commands)
    card_bills.rs                  card_days, card_close_day, list_cards,
                                   fatura_capable_card_ids, is_card_bill,
                                   fatura_close_month, card_bill, ensure_card_bills,
                                   refresh_card_bills, card_debit_expenses,
                                   billing_period, last_day_of
    report.rs                      month_income, month_expenses, pm_expenses,
                                   no_pm_expenses, income_by_category,
                                   expenses_by_category, expenses_by_pm,
                                   monthly_series, account_balance_at, sync_generated,
                                   DashboardData, ChartData, MonthlyPoint, BreakdownRow,
                                   get_dashboard/sync_dashboard/get_chart_data (commands)
  organizacao_financeira/
    mod.rs                         barrel
    models.rs                      TransactionInput, TransactionRow, CardBillDetail,
                                   PaymentMethodInput, PaymentMethod, CategoryInput,
                                   Category, FixedBillInput, FixedBill, LoanInput,
                                   Loan, AmortizationRow, LoanDetail
    repository.rs                  list_transactions, get_card_bill, card_bill_purchases,
                                   list_payment_methods, list_categories,
                                   list_fixed_bills, list_loans, get_loan_detail,
                                   list (whitelists de sort por entidade)
    service.rs                     validate/metadata_for de cada entidade, create/update/
                                   delete SQL, generate_fixed_bills,
                                   reconcile_fixed_bills, generate_loan_installments,
                                   installment_index, installment_finished,
                                   purchase_installment, loan_monthly_rate,
                                   loan_schedule
    controller.rs                  todos os #[tauri::command] das 5 entidades
  investimentos/
    mod.rs                         barrel
    repository.rs                  list_reserva_movements, reserva_balance_at
    service.rs                     month_investments
    controller.rs                  list_reserva_movements (command)
```

## Mapa de origem (inventário atual)

| Origem | Símbolos | Destino |
|---|---|---|
| `models.rs:3-8` | `month_str_to_date`, `add_months` | `shared/util.rs` |
| `models.rs:19-340` | inputs + rows + details das entidades | `organizacao_financeira/models.rs` |
| `models.rs:309-339` | `BreakdownRow`, `DashboardData`, `MonthlyPoint`, `ChartData` | `shared/report.rs` |
| `models.rs:342-377` | `Settings`, `SettingsInput` | `shared/settings.rs` |
| `domain.rs:4-66` | `parse_month`, `month_range`, `month_diff`, `installment_index`, `installment_finished`, `purchase_installment`, `last_day_of`, `billing_period`, `current_month` | `shared/util.rs` (últimos 3) + `organizacao_financeira/service.rs` (installment/purchase) |
| `domain.rs:72-127` | `get_settings`, `set_settings`, `earliest_month`, `earliest_tx_month` | `shared/settings.rs` |
| `domain.rs:137-160` | `db_err`, `order_clause` | `shared/util.rs` |
| `domain.rs:162-404` | `month_income`, `pm_expenses`, `card_debit_expenses`, `no_pm_expenses`, `card_close_day`, `card_days`, `list_cards`, `fatura_capable_card_ids`, `is_card_bill`, `fatura_close_month`, `card_bill`, `ensure_card_bills`, `refresh_card_bills` | `shared/card_bills.rs` (card) + `shared/report.rs` (month_income, pm_expenses, no_pm_expenses, month_expenses) |
| `domain.rs:407-660` | `month_expenses`, `income_by_category`, `expenses_by_category`, `reserva_balance_at`, `account_balance_at`, `monthly_series`, `expenses_by_pm`, `generate_fixed_bills` | `shared/report.rs` (agregados) + `organizacao_financeira/service.rs` (generate_fixed_bills) |
| `domain.rs:736-904` | `generate_loan_installments`, `sync_generated`, `reconcile_fixed_bills`, `loan_monthly_rate`, `loan_schedule` | `organizacao_financeira/service.rs` + `shared/report.rs` (sync_generated) |
| `commands/categories.rs` | inteiro | `organizacao_financeira/{service,controller}.rs` |
| `commands/payment_methods.rs` | inteiro | `organizacao_financeira/{service,controller}.rs` |
| `commands/fixed_bills.rs` | inteiro | `organizacao_financeira/{service,controller}.rs` |
| `commands/loans.rs` | inteiro | `organizacao_financeira/{service,controller}.rs` |
| `commands/transactions.rs` | tudo exceto `list_reserva_movements` | `organizacao_financeira/{repository,service,controller}.rs` |
| `commands/transactions.rs:101` | `list_reserva_movements` | `investimentos/repository.rs` + `controller.rs` |
| `commands/settings.rs` | inteiro | `shared/settings.rs` |
| `commands/dashboard.rs`, `commands/chart.rs`, `commands/meta.rs` | inteiro | `shared/report.rs` + `shared/util.rs` |

`reserva_balance_at` e `month_investments` (aporte) → `investimentos/repository.rs` / `investimentos/service.rs`. `month_investments` já é usada pelo dashboard — mover na Task 10 e ajustar o import do `report.rs` para `crate::investimentos::service::month_investments`.

---

### Task 1: Skeleton dos módulos + `shared/util.rs`

**Files:**
- Create: `src-tauri/src/shared/mod.rs`
- Create: `src-tauri/src/shared/util.rs`
- Modify: `src-tauri/src/lib.rs:7-10`

- [ ] **Step 1: Criar `shared/mod.rs`**

```rust
pub mod card_bills;
pub mod report;
pub mod settings;
pub mod util;

#[cfg(test)]
pub(crate) fn test_db() -> rusqlite::Connection {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(include_str!("../../migrations/001_init.sql"))
        .unwrap();
    conn.execute_batch(include_str!("../../migrations/002_card_bills.sql"))
        .unwrap();
    conn.execute_batch(include_str!("../../migrations/006_card_debit.sql"))
        .unwrap();
    conn.execute_batch(include_str!("../../migrations/008_settings.sql"))
        .unwrap();
    conn
}

#[cfg(test)]
pub(crate) fn add_pm(conn: &rusqlite::Connection, name: &str, ty: i64, meta: Option<&str>) -> i64 {
    conn.execute(
        "INSERT INTO payment_methods (name, type, metadata) VALUES (?1, ?2, ?3)",
        rusqlite::params![name, ty, meta],
    )
    .unwrap();
    conn.last_insert_rowid()
}

#[cfg(test)]
pub(crate) fn add_tx(
    conn: &rusqlite::Connection,
    desc: &str,
    amount: i64,
    date: &str,
    pm_id: Option<i64>,
) {
    conn.execute(
        "INSERT INTO transactions (description, amount, type, date, payment_method_id)
         VALUES (?1, ?2, 2, ?3, ?4)",
        rusqlite::params![desc, amount, date, pm_id],
    )
    .unwrap();
}
```

- [ ] **Step 2: Mover helpers para `shared/util.rs`**

Mover verbatim de `domain.rs`: `parse_month`, `month_range`, `month_diff`, `db_err`, `order_clause`, `current_month`. Mover verbatim de `models.rs`: `month_str_to_date`, `add_months`. Adicionar os commands do `commands/meta.rs`:

```rust
use crate::db::{with_db, AppState};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn get_earliest_month(state: State<'_, AppState>) -> Result<String, String> {
    with_db(&state, crate::shared::settings::earliest_month)
}

#[tauri::command]
pub fn get_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}
```
Cabeçalho do arquivo:
```rust
use chrono::NaiveDate;
```
Mover junto os testes `order_clause_chave_valida` e `order_clause_fallback_padrao` do `domain.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn order_clause_chave_valida() { /* verbatim */ }
    #[test]
    fn order_clause_fallback_padrao() { /* verbatim */ }
}
```
Criar `shared/settings.rs`, `shared/card_bills.rs`, `shared/report.rs`, `organizacao_financeira/`, `investimentos/` como arquivos vazios de placeholder (apenas `// preenchido nas tasks seguintes`) para `mod` compilar.

- [ ] **Step 3: Declarar no lib.rs**

Em `src-tauri/src/lib.rs`, após `pub mod db;`:
```rust
pub mod shared;
pub mod organizacao_financeira;
pub mod investimentos;
```

- [ ] **Step 4: Rodar testes**

Run: `cargo test`
Expected: ainda passa (domain/models intactos; novos mods vazios).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/
git commit -m "refactor: skeleton de módulos shared/org/investimentos"
```

---

### Task 2: `shared/settings.rs`

- [ ] **Step 1: Mover conteúdo**

Mover verbatim de `models.rs`: `Settings`, `SettingsInput`, `impl SettingsInput::validate` (trocar `crate::models::Settings` → `Settings` local). Mover verbatim de `domain.rs`: `get_settings`, `set_settings`, `earliest_month`, `earliest_tx_month`. Adicionar os commands de `commands/settings.rs`:
```rust
use crate::db::{with_db, AppState};
use tauri::State;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    with_db(&state, get_settings_impl)
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    input: SettingsInput,
) -> Result<(), String> {
    with_db(&state, |c| set_settings(c, &input))
}
```
(renomear a fn de domínio `get_settings` → `get_settings_impl` para não colidir com o command; atualizar as 4 referências internas a `crate::domain::get_settings` e o `use` de `commands/dashboard.rs:30` e `commands/transactions.rs:104` para `crate::shared::settings::get_settings_impl`.)

- [ ] **Step 2: Mover teste**

Mover o teste `settings_roundtrip_inclui_meta_investimento` (se existir do plano da meta) e o teste de `earliest_month`/defaults que testar get/set settings. Adaptar `use super::*;` + `use crate::shared::{test_db};`.

- [ ] **Step 3: Remover do original**

Remover de `models.rs` (342-377) e `domain.rs` (72-124) os símbolos movidos.

- [ ] **Step 4: Corrigir referências**

`rtk grep -rn "crate::models::Settings\|crate::models::SettingsInput\|domain::get_settings\|domain::set_settings\|domain::earliest_month" src-tauri/src` e apontar para `crate::shared::settings::*`.

- [ ] **Step 5: Testar e commitar**

Run: `cargo test`
Commit: `refactor: settings movido para shared/settings`

---

### Task 3: `shared/card_bills.rs`

- [ ] **Step 1: Mover conteúdo**

Mover verbatim de `domain.rs` (na ordem do arquivo): `last_day_of`, `billing_period`, `card_debit_expenses`, `card_close_day`, `card_days`, `list_cards`, `fatura_capable_card_ids`, `is_card_bill`, `fatura_close_month`, `card_bill`, `ensure_card_bills`, `refresh_card_bills`. Trocar referências a `crate::models::` por imports locais. Funções usadas por outros módulos viram `pub(crate)` se preciso (regra 2).

- [ ] **Step 2: Mover testes**

Mover de `domain.rs` os testes: `card_without_validity_keeps_billing_period`, `refresh_card_bills_gera_fatura_em_mes_futuro` e quaisquer outros `card_bill*`/`fatura*`/`billing*`/`card_*`. Helpers via `use crate::shared::{test_db, add_pm, add_tx};`.

- [ ] **Step 3: Remover e corrigir**

Remover do `domain.rs`. `rtk grep -rn "card_days\|card_close_day\|ensure_card_bills\|refresh_card_bills\|fatura_capable_card_ids\|is_card_bill\|card_debit_expenses\|billing_period\|last_day_of" src-tauri/src` e atualizar paths para `crate::shared::card_bills::`.

- [ ] **Step 4: Testar e commitar**

Run: `cargo test`
Commit: `refactor: card bills movido para shared/card_bills`

---

### Task 4: `organizacao_financeira/models.rs`

- [ ] **Step 1: Mover models**

Mover verbatim de `models.rs` (19-308): `TransactionInput`, `PaymentMethodInput`, `CategoryInput`, `FixedBillInput`, `LoanInput`, `PaymentMethod`, `Category`, `TransactionRow`, `CardBillDetail`, `FixedBill`, `Loan`, `AmortizationRow`, `LoanDetail` + seus `impl validate` (que usam `month_str_to_date`, `purchase_installment` — importar de `crate::shared::util` / `crate::super::service`). Remover de `models.rs` o que restou além de `BreakdownRow`/`DashboardData`/`MonthlyPoint`/`ChartData`.

- [ ] **Step 2: Corrigir referências**

`rtk grep -rn "crate::models::" src-tauri/src | rtk grep -v "shared\|organizacao\|investimentos"` → atualizar cada entidade para `crate::organizacao_financeira::models::X`. `models.rs` restante (relatórios) vira placeholder até a Task 5.

- [ ] **Step 3: Testar e commitar**

Run: `cargo test`
Commit: `refactor: models das entidades movidos para organizacao_financeira`

---

### Task 5: `shared/report.rs`

- [ ] **Step 1: Mover conteúdo**

Mover verbatim de `models.rs`: `BreakdownRow`, `DashboardData`, `MonthlyPoint`, `ChartData`. Mover verbatim de `domain.rs`: `month_income`, `pm_expenses`, `no_pm_expenses`, `month_expenses`, `income_by_category`, `expenses_by_category`, `expenses_by_pm`, `account_balance_at`, `monthly_series`, `sync_generated`. Trazer os commands `get_dashboard`, `sync_dashboard` de `commands/dashboard.rs` e `get_chart_data` de `commands/chart.rs` (o helper `build` do dashboard também vai junto; ajustar imports: `crate::domain::generate_fixed_bills` → `crate::organizacao_financeira::service::generate_fixed_bills`, `crate::domain::refresh_card_bills` → `crate::shared::card_bills::refresh_card_bills`, `crate::domain::get_settings` → `crate::shared::settings::get_settings_impl`, `crate::domain::month_investments` → `crate::investimentos::service::month_investments`).

- [ ] **Step 2: Mover testes**

Mover testes de agregação/relatório de `domain.rs` (income, expenses, monthly_series, balance). Ver exemplo `monthly_series_inclui_saldo_da_reserva` para o padrão.

- [ ] **Step 3: Remover e corrigir**

Remover do `domain.rs` e `models.rs` (deletar `models.rs` se vazio). `rtk grep -rn "crate::domain::" src-tauri/src` → atualizar cada path.

- [ ] **Step 4: Testar e commitar**

Run: `cargo test`
Commit: `refactor: relatórios movidos para shared/report`

---

### Task 6: `organizacao_financeira` — categories e payment_methods

- [ ] **Step 1: Mover commands**

Mover verbatim de `commands/categories.rs` e `commands/payment_methods.rs` para:
- `controller.rs`: as fns `#[tauri::command]` (`list_*`, `create_*`, `update_*`, `delete_*`) como wrappers `with_db`.
- `service.rs`: `validate`, `metadata_for`, e a fn `create` não-command (ex.: `pub fn create(conn, input)`) — renomear para `create_category`/`create_payment_method` se o nome colidir com o command.
- `repository.rs`: a fn `list` (SQL + whitelist de sort).

Cabeçalhos:
```rust
// controller.rs
use crate::db::{with_db, AppState};
use crate::organizacao_financeira::service;
use crate::organizacao_financeira::models::{CategoryInput, PaymentMethodInput};
use tauri::State;
```

- [ ] **Step 2: Mover testes**

Mover testes dessas entidades de `domain.rs`/`commands/` para `organizacao_financeira/service.rs` (`mod tests` com `use crate::shared::{test_db};`). Se não houver testes específicos, apenas garantir `cargo test` verde.

- [ ] **Step 3: Remover arquivos antigos**

Deletar `commands/categories.rs` e `commands/payment_methods.rs`; remover `pub mod categories;`/`pub mod payment_methods;` de `commands/mod.rs`.

- [ ] **Step 4: Testar e commitar**

Run: `cargo test`
Commit: `refactor: categories e payment_methods no módulo organizacao_financeira`

---

### Task 7: fixed_bills

- [ ] **Step 1: Mover commands + domain**

De `commands/fixed_bills.rs`: command fns → `controller.rs`; `list` → `repository.rs`. De `domain.rs`: `generate_fixed_bills`, `reconcile_fixed_bills` → `service.rs` (verificar dependências internas; `installment_finished`/`installment_index`/`purchase_installment` → `service.rs` também nesta task se ainda não movidos).

- [ ] **Step 2: Mover testes**

Testes `fixed_bill*`, `installment*`, `purchase_installment*` de `domain.rs` → `organizacao_financeira/service.rs`.

- [ ] **Step 3: Remover e corrigir**

Deletar `commands/fixed_bills.rs`; remover de `commands/mod.rs`. Atualizar referências (`generate_fixed_bills` usado por `report.rs`).

- [ ] **Step 4: Testar e commitar**

Run: `cargo test`
Commit: `refactor: contas fixas no módulo organizacao_financeira`

---

### Task 8: loans

- [ ] **Step 1: Mover**

De `commands/loans.rs`: commands → `controller.rs`; `list`/`get_loan_detail` → `repository.rs`. De `domain.rs`: `loan_monthly_rate`, `loan_schedule`, `generate_loan_installments` → `service.rs`. De `models.rs`: `Loan`, `LoanInput`, `LoanDetail`, `AmortizationRow` já estão em `organizacao_financeira/models.rs` (Task 4).

- [ ] **Step 2: Testes + remoção**

Mover testes de loan. Deletar `commands/loans.rs`; atualizar `commands/mod.rs`.

- [ ] **Step 3: Testar e commitar**

Run: `cargo test`
Commit: `refactor: financiamentos no módulo organizacao_financeira`

---

### Task 9: transactions

- [ ] **Step 1: Mover**

De `commands/transactions.rs` (exceto `list_reserva_movements`): commands → `controller.rs`; `list` (whitelist) e `get_card_bill`/`card_bill_purchases` → `repository.rs`; `create`, `update`, `delete_ids` → `service.rs`. Ajustar `use crate::shared::card_bills::{...}` e `use crate::shared::settings::get_settings_impl` conforme as referências internas.

- [ ] **Step 2: Mover testes**

Testes de transaction (fatura, card, tipo 4/5) → `organizacao_financeira/service.rs` (os de `reserva_balance_*` vão para investimentos na Task 10).

- [ ] **Step 3: Remover e corrigir**

Deletar `commands/transactions.rs`; remover de `commands/mod.rs`; atualizar referências.

- [ ] **Step 4: Testar e commitar**

Run: `cargo test`
Commit: `refactor: transações no módulo organizacao_financeira`

---

### Task 10: `investimentos`

- [ ] **Step 1: Criar módulo**

`investimentos/repository.rs`:
```rust
use crate::db::AppState;
use crate::organizacao_financeira::models::TransactionRow;
use rusqlite::Connection;

/// Movimentações da reserva (type 4 adição, 5 remoção), mais recentes primeiro.
pub fn list_reserva_movements_impl(conn: &Connection) -> Result<Vec<TransactionRow>, String> {
    /* verbatim de commands/transactions.rs:101 */
}

/// Saldo da reserva acumulado até `before` (data exclusiva).
pub fn reserva_balance_at(conn: &Connection, before: chrono::NaiveDate) -> Result<i64, String> {
    /* verbatim de domain.rs:521 */
}
```
`investimentos/service.rs`:
```rust
/// Soma dos aportes à reserva (type = 4) no período.
pub fn month_investments(
    conn: &rusqlite::Connection,
    start: chrono::NaiveDate,
    end: chrono::NaiveDate,
) -> Result<i64, String> {
    /* verbatim de domain.rs (função do plano da meta) */
}
```
`investimentos/controller.rs`:
```rust
use crate::db::{with_db, AppState};
use crate::investimentos::repository;
use crate::organizacao_financeira::models::TransactionRow;
use tauri::State;

#[tauri::command]
pub async fn list_reserva_movements(state: State<'_, AppState>) -> Result<Vec<TransactionRow>, String> {
    with_db(&state, repository::list_reserva_movements_impl)
}
```
`investimentos/mod.rs`:
```rust
pub mod controller;
pub mod repository;
pub mod service;
```

- [ ] **Step 2: Ajustar report.rs**

`shared/report.rs` passa a usar `crate::investimentos::service::month_investments` (se já referenciado pelo plano da meta).

- [ ] **Step 3: Mover testes**

Testes `reserva_balance_*` de `domain.rs` → `investimentos/repository.rs` (ou service).

- [ ] **Step 4: Remover e testar**

Remover referências antigas. Run: `cargo test`
Commit: `refactor: módulo investimentos com reserva e meta`

---

### Task 11: Finalizar — deletar `domain.rs` e `commands/`

- [ ] **Step 1: Esvaziar domain.rs**

Após mover todos os símbolos, verificar com `cargo check` se restou algo em `domain.rs`/`models.rs`. Mover o que sobrar para o módulo certo e **deletar** `domain.rs`, `models.rs`, `commands/` (diretório inteiro).

- [ ] **Step 2: Atualizar lib.rs**

Remover `pub mod commands; pub mod domain; pub mod models;`. Handler final com paths explícitos:
```rust
.invoke_handler(tauri::generate_handler![
    crate::shared::util::get_earliest_month,
    crate::shared::util::get_version,
    crate::shared::settings::get_settings,
    crate::shared::settings::update_settings,
    crate::shared::report::get_dashboard,
    crate::shared::report::sync_dashboard,
    crate::shared::report::get_chart_data,
    crate::organizacao_financeira::controller::list_transactions,
    crate::investimentos::controller::list_reserva_movements,
    crate::organizacao_financeira::controller::create_transaction,
    crate::organizacao_financeira::controller::update_transaction,
    crate::organizacao_financeira::controller::delete_transactions,
    crate::organizacao_financeira::controller::get_card_bill,
    crate::organizacao_financeira::controller::list_payment_methods,
    crate::organizacao_financeira::controller::create_payment_method,
    crate::organizacao_financeira::controller::update_payment_method,
    crate::organizacao_financeira::controller::delete_payment_methods,
    crate::organizacao_financeira::controller::list_categories,
    crate::organizacao_financeira::controller::create_category,
    crate::organizacao_financeira::controller::update_category,
    crate::organizacao_financeira::controller::delete_categories,
    crate::organizacao_financeira::controller::list_fixed_bills,
    crate::organizacao_financeira::controller::create_fixed_bill,
    crate::organizacao_financeira::controller::update_fixed_bill,
    crate::organizacao_financeira::controller::delete_fixed_bills,
    crate::organizacao_financeira::controller::list_loans,
    crate::organizacao_financeira::controller::get_loan_detail,
    crate::organizacao_financeira::controller::create_loan,
    crate::organizacao_financeira::controller::update_loan,
    crate::organizacao_financeira::controller::delete_loans,
])
```
(nomes de fn podem variar — conferir o nome real de cada `#[tauri::command]` ao mover; o handler NÃO pode ter `*`.)

- [ ] **Step 3: Verificação final**

Run: `cargo test` e `cargo build`
Expected: tudo verde.

- [ ] **Step 4: Commit**

```bash
git add -A src-tauri/src
git commit -m "refactor: domínio organizado em módulos shared/org/investimentos"
```

---

### Task 12: Self-review

- [ ] Estrutura-alvo do diagrama satisfeita (cada módulo com models/repository/service/controller)
- [ ] `cargo test` verde
- [ ] `cargo build` verde
- [ ] Nenhuma referência a `crate::domain`, `crate::models` ou `crate::commands` sobrou:
  Run: `rtk grep -rn "crate::domain\|crate::models\|crate::commands" src-tauri/src`
  Expected: nenhum match.
