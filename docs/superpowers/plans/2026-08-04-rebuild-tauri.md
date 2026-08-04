# Rebuild AjudaFinancas em Tauri — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir o app financeiro AjudaFinancas (Go/GORM/htmx/webview) como app desktop Tauri v2 + Next.js + shadcn/ui, funcionalidade 1:1, banco novo.

**Architecture:** Tauri backend Rust (rusqlite + rusqlite_migration) expõe comandos `invoke()` para frontend Next.js estático (App Router, `output: 'export'`). Lógica de negócio (geração de contas fixas, parcelas de empréstimo, amortização, billing period de cartão, dashboard) mora em Rust com testes unit; UI é shadcn/ui + Tailwind 4. Scaffold base: `create-tauri-ui` (template Next.js).

**Tech Stack:** Tauri v2, Next.js 15 (static export), shadcn/ui, Tailwind 4, rusqlite (bundled), rusqlite_migration, chrono, tauri-plugin-updater, bun.

**Referência (repo antigo):** `/home/daniel/Projects/AjudaFinancas` — use para consultar comportamento exato dos handlers/modelos Go quando em dúvida.

---

## Visão geral de arquivos

**Novo projeto** (`/home/daniel/Projects/AjudaFinancasTauri`):

```
src-tauri/
  Cargo.toml
  migrations/001_init.sql        # schema + seed
  src/main.rs                    # template (unchanged)
  src/lib.rs                     # run(): setup DB, register commands, plugins
  src/db.rs                      # AppState, open(), migrations(), seed()
  src/models.rs                  # DTOs (serde) + validações
  src/domain.rs                  # regras de negócio + queries + testes
  src/commands/{mod,meta,dashboard,transactions,payment_methods,categories,fixed_bills,loans}.rs
  tauri.conf.json
  capabilities/default.json
src/
  app/layout.tsx                 # sidebar, ThemeProvider, MonthProvider, Sonner, update check
  app/page.tsx                   # dashboard
  app/transactions/page.tsx
  app/payment-methods/page.tsx
  app/categories/page.tsx
  app/fixed-bills/page.tsx
  app/installments/page.tsx
  app/loans/page.tsx
  components/crud/{CrudPage,FormDialog,DataTable}.tsx
  components/confirm.tsx
  components/MonthPicker.tsx
  components/UpdateDialog.tsx
  components/forms/*.tsx         # forms por domínio
  lib/{types,api,format,month-context}.ts
  components/ui/*                # shadcn
```

**Convenções de dados:**
- Valores monetários: inteiros em **centavos** (`i64` no Rust, `number` no TS).
- Datas: `TEXT "YYYY-MM-DD"`. Meses: `TEXT "YYYY-MM"`. Comparações lexicográficas são seguras.
- Tipos por número: transação/categoria 1=receita 2=despesa; forma de pagamento 1=padrão 2=cartão; empréstimo 1=emprestar 2=financiamento.
- JS chama `invoke("cmd", { arg: v })`; Tauri converte chaves camelCase→snake_case nos args. Structs Rust usam `#[serde(rename_all = "camelCase")]` para campos aninhados; campo `type` em Rust é `type_` com `#[serde(rename = "type")]`.

---

## Fase 0 — Ambiente e scaffold

### Task 1: Instalar toolchain

- [ ] **Step 1: Instalar Rust (rustup)**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal
source "$HOME/.cargo/env"
rustc --version && cargo --version
```

Expected: imprime versões (ex. `rustc 1.8x.0`). Se zsh não achar, reabrir shell ou exportar `$HOME/.cargo/bin`.

- [ ] **Step 2: Instalar bun**

```bash
curl -fsSL https://bun.sh/install | bash
source "$HOME/.bashrc" 2>/dev/null; export PATH="$HOME/.bun/bin:$PATH"
bun --version
```

Expected: versão `bun x.y.z`.

- [ ] **Step 3: Dependências de sistema do Tauri (Linux)**

```bash
sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Expected: pacotes instalados sem erro.

### Task 2: Scaffold tauri-ui (Next.js) e mover para o projeto

- [ ] **Step 1: Scaffold em diretório temporário**

`create-tauri-ui` não suporta scaffold no diretório atual. Scaffold em `/tmp` e move.

```bash
cd /tmp/opencode
rm -rf ajuda-tauri
bunx create-tauri-ui@latest ajuda-tauri --template next --identifier com.ajudafinancas.app --yes
```

Expected: gera `ajuda-tauri/` com `src-tauri/` e frontend Next.js (prompts respondidos com defaults: starter dashboard sim, invoke example sim, workflow sim).

- [ ] **Step 2: Mover conteúdo para o projeto**

```bash
rsync -a --exclude='.git' /tmp/opencode/ajuda-tauri/ /home/daniel/Projects/AjudaFinancasTauri/
rm -rf /tmp/opencode/ajuda-tauri
```

- [ ] **Step 3: Instalar dependências e verificar build do frontend**

```bash
cd /home/daniel/Projects/AjudaFinancasTauri
bun install
bun run build
```

Expected: Next.js gera `out/` sem erro. Anote qualquer diferença de estrutura do template (ex.: layout em `src/app/layout.tsx`, tauri em `src-tauri/src/lib.rs`) — os caminhos abaixo assumem esse layout padrão; ajuste se o template divergir.

- [ ] **Step 4: Verificar backend compila**

```bash
cd src-tauri && cargo check 2>&1 | tail -5
```

Expected: compila sem erro. Instala toolchain/tauri-crabs na primeira vez (pode levar minutos).

- [ ] **Step 5: Configurar identidade do app**

Edite `src-tauri/tauri.conf.json`:
- `productName`: `"Ajuda Finanças"`
- `mainBinaryName`: `"ajudafinancas"`
- `version`: `"0.1.0"`
- `app.windows[0].title`: `"Ajuda Finanças"`

Edite `src-tauri/Cargo.toml`:
- `[package] name` = `ajudafinancas`, `lib.name` = `ajudafinancas_lib` (se `crate-type` for `staticlib`/`cdylib` para mobile) ou deixe o nome do template se o scaffold usar outro; o importante é `package.name`.

Verifique `frontendDist` e `devUrl` apontando para `../out` e `http://localhost:3000` (o template já aplica).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold tauri-ui nextjs"
```

### Task 3: Adicionar dependências Rust e plugin updater

- [ ] **Step 1: `cargo add` deps**

```bash
cd src-tauri
cargo add rusqlite --features bundled,derive
cargo add rusqlite_migration
cargo add chrono --features serde
cargo add serde_json
cargo add tauri-plugin-updater@2
```

Expected: atualiza `Cargo.toml`. Se `derive` feature de rusqlite não existir na versão resolvida (erro de feature), faça `cargo add rusqlite --features bundled` e use mapeamento manual de rows (veja nota no Task 5, Step 1).

- [ ] **Step 2: Plugin updater no npm e capabilities**

```bash
cd /home/daniel/Projects/AjudaFinancasTauri
bun add @tauri-apps/plugin-updater
```

Em `src-tauri/capabilities/default.json`, adicione `"updater:default"` ao array `permissions`.

Em `src-tauri/tauri.conf.json`, adicione (placeholder; configure de verdade no Task 30):

```json
"plugins": {
  "updater": {
    "pubkey": "TROQUE_PELA_PUBKEY_GERADA",
    "endpoints": ["https://github.com/SEU_USUARIO/AjudaFinancasTauri/releases/latest/download/latest.json"]
  }
}
```

E no bloco `bundle`:

```json
"createUpdaterArtifacts": true
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: adiciona deps rust e plugin updater"
```

---

## Fase 1 — Backend Rust

### Task 4: db.rs — conexão, migrações, seed

**Files:**
- Create: `src-tauri/src/db.rs`

- [ ] **Step 1: Escrever o teste que falha**

Create `src-tauri/tests/db_test.rs`:

```rust
use ajedafinancas_lib::db; // ajuste o nome do crate lib conforme scaffold
```

Pare. Crie antes o crate lib público. Verifique o `src-tauri/src/lib.rs` do template: ele exporta `pub fn run()`. Precisamos expor `pub mod db` para testes. Escreva o teste real:

Create `src-tauri/src/db.rs` com um esqueleto e `src-tauri/tests/db_test.rs`:

```rust
use ajedafinancas_lib::db::migrations;
use rusqlite::Connection;

#[test]
fn migrations_criam_tabelas_e_seed() {
    let mut conn = Connection::open_in_memory().unwrap();
    migrations().to_latest(&mut conn).unwrap();
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM payment_methods", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 2, "seed deve inserir PIX e Boleto");
}
```

(Em Task 5 o seed vira parte da migration. Se o seed ficar em `db::seed`, ajuste: veja Step 3 abaixo — seed será SQL na migration 001, então o teste acima vale como está.)

- [ ] **Step 2: Rodar teste e ver falhar**

```bash
cd src-tauri && cargo test --test db_test 2>&1 | tail -15
```

Expected: falha — `db` module ou função `migrations` não existe, ou migration 001 ausente.

- [ ] **Step 3: Implementar**

Create `src-tauri/src/db.rs`:

```rust
use rusqlite::Connection;
use rusqlite_migration::{Migration, Migrations};
use std::fs;
use tauri::{AppHandle, Manager};

pub struct AppState {
    pub db: std::sync::Mutex<Connection>,
}

pub fn migrations() -> Migrations {
    Migrations::new(vec![
        Migration::up(include_str!("../migrations/001_init.sql")),
    ])
}

pub fn open(app: &AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    fs::create_dir_all(&dir)?;
    let path = dir.join("ajudafinancas.db");
    let mut conn = Connection::open(path)?;
    migrations().to_latest(&mut conn)?;
    Ok(conn)
}

pub fn with_db<T>(
    state: &tauri::State<'_, AppState>,
    f: impl FnOnce(&Connection) -> Result<T, String>,
) -> Result<T, String> {
    let guard = state
        .db
        .lock()
        .map_err(|_| "banco de dados bloqueado".to_string())?;
    f(&guard)
}
```

Crie `src-tauri/migrations/001_init.sql` (schema + seed — mesmo arquivo da Task 5; escreva já o conteúdo completo da Task 5 Step 1 aqui para o teste do seed passar).

Edite `src-tauri/src/lib.rs`: declare `pub mod db;` no topo (o template tem `mod <algo>`; adicione `pub mod db;`).

- [ ] **Step 4: Rodar teste e ver passar**

```bash
cd src-tauri && cargo test --test db_test 2>&1 | tail -15
```

Expected: `test migrations_criam_tabelas_e_seed ... ok`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: conexao sqlite com migracoes e seed"
```

### Task 5: Migration 001 — schema completo

**Files:**
- Create: `src-tauri/migrations/001_init.sql` (se já não existe do Task 4)

- [ ] **Step 1: Escrever a migration**

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type INTEGER NOT NULL,
  metadata TEXT
);
CREATE INDEX idx_payment_methods_type ON payment_methods(type);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type INTEGER NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  icon TEXT
);
CREATE INDEX idx_categories_type ON categories(type);

CREATE TABLE fixed_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  day INTEGER NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id),
  start_month TEXT NOT NULL,
  end_month TEXT,
  installments INTEGER
);

CREATE TABLE loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type INTEGER NOT NULL,
  description TEXT NOT NULL,
  principal INTEGER NOT NULL,
  installment INTEGER NOT NULL,
  total_installments INTEGER NOT NULL,
  day INTEGER NOT NULL,
  start_month TEXT NOT NULL,
  payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id)
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type INTEGER NOT NULL,
  date TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  payment_method_id INTEGER REFERENCES payment_methods(id),
  fixed_bill_id INTEGER REFERENCES fixed_bills(id) ON DELETE SET NULL,
  loan_id INTEGER REFERENCES loans(id) ON DELETE SET NULL
);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_payment_method ON transactions(payment_method_id);
CREATE INDEX idx_transactions_fixed_bill ON transactions(fixed_bill_id);
CREATE INDEX idx_transactions_loan ON transactions(loan_id);

INSERT INTO payment_methods (name, type, metadata) VALUES ('PIX', 1, NULL), ('Boleto', 1, NULL);
```

- [ ] **Step 2: Rodar testes existentes**

```bash
cd src-tauri && cargo test 2>&1 | tail -10
```

Expected: db_test passa. (Valida que a migration compila e o seed roda.)

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: migration 001 schema completo"
```

### Task 6: models.rs — DTOs e validações

**Files:**
- Create: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/lib.rs` (declarar `pub mod models;`)

- [ ] **Step 1: Escrever teste que falha**

Create `src-tauri/tests/models_test.rs`:

```rust
use ajedafinancas_lib::models::{CategoryInput, FixedBillInput, LoanInput, TransactionInput};

#[test]
fn valida_transacao() {
    let t = TransactionInput {
        description: "".into(),
        amount: 100,
        type_: 2,
        date: "2026-01-10".into(),
        category_id: None,
        payment_method_id: None,
    };
    assert!(t.validate().is_err(), "descrição vazia deve falhar");

    let mut t2 = t.clone();
    t2.description = "Conta".into();
    assert!(t2.validate().is_err(), "despesa sem forma de pagamento deve falhar");

    t2.payment_method_id = Some(1);
    assert!(t2.validate().is_ok());
}

#[test]
fn valida_conta_fixa() {
    let b = FixedBillInput {
        description: "Aluguel".into(),
        amount: 100_000,
        day: 5,
        category_id: None,
        payment_method_id: Some(1),
        start_month: "2026-01".into(),
        end_month: None,
        installments: None,
    };
    assert!(b.validate().is_ok());

    let mut b2 = b.clone();
    b2.installments = Some(1);
    assert!(b2.validate().is_err(), "parcelas < 2 deve falhar");

    b2.installments = Some(3);
    assert!(b2.validate().is_ok(), "parcelas >= 2 define end_month");

    let mut b3 = b.clone();
    b3.end_month = Some("2025-12".into());
    assert!(b3.validate().is_err(), "fim antes do início deve falhar");
}

#[test]
fn valida_emprestimo() {
    let l = LoanInput {
        type_: 1,
        description: "Empréstimo".into(),
        principal: 100_000,
        installment: 35_000,
        total_installments: 3,
        day: 10,
        start_month: "2026-01".into(),
        payment_method_id: Some(1),
    };
    assert!(l.validate().is_ok());

    let mut l2 = l.clone();
    l2.total_installments = 1;
    assert!(l2.validate().is_err(), "parcelas < 2 deve falhar");

    let mut l3 = l.clone();
    l3.installment = 20_000; // total 60k < 100k principal
    assert!(l3.validate().is_err(), "total menor que principal deve falhar");
}
```

Nota: `TransactionInput` etc. usam `#[serde(rename = "type")]` em `type_`; os campos dos structs acima precisam ser exatamente como no Step 3.

- [ ] **Step 2: Rodar teste e ver falhar**

```bash
cd src-tauri && cargo test --test models_test 2>&1 | tail -10
```

Expected: falha — módulo `models` ou campos não existem.

- [ ] **Step 3: Implementar models.rs**

```rust
use serde::{Deserialize, Serialize};

fn month_str_to_date(s: &str) -> Result<chrono::NaiveDate, String> {
    chrono::NaiveDate::parse_from_str(&format!("{s}-01"), "%Y-%m-%d")
        .map_err(|_| format!("mês inválido: {s}"))
}

fn add_months(s: &str, n: u32) -> String {
    let d = month_str_to_date(s).unwrap();
    d.checked_add_months(chrono::Months::new(n))
        .unwrap()
        .format("%Y-%m")
        .to_string()
}

// ---- Inputs (create/update) ----

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionInput {
    pub description: String,
    pub amount: i64,
    #[serde(rename = "type")]
    pub type_: i64,
    pub date: String,
    pub category_id: Option<i64>,
    pub payment_method_id: Option<i64>,
}

impl TransactionInput {
    pub fn validate(&self) -> Result<(), String> {
        if self.description.trim().is_empty() {
            return Err("descrição é obrigatória".into());
        }
        if self.amount <= 0 {
            return Err("valor deve ser maior que zero".into());
        }
        if self.type_ != 1 && self.type_ != 2 {
            return Err("tipo deve ser receita (1) ou despesa (2)".into());
        }
        if chrono::NaiveDate::parse_from_str(&self.date, "%Y-%m-%d").is_err() {
            return Err("data inválida".into());
        }
        if self.type_ == 2 && self.payment_method_id.is_none() {
            return Err("forma de pagamento é obrigatória para despesas".into());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentMethodInput {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: i64,
    pub close_day: Option<i64>,
    pub validity_day: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryInput {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: i64,
    pub color: String,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixedBillInput {
    pub description: String,
    pub amount: i64,
    pub day: i64,
    pub category_id: Option<i64>,
    pub payment_method_id: i64,
    pub start_month: String,
    pub end_month: Option<String>,
    pub installments: Option<i64>,
}

impl FixedBillInput {
    pub fn validate(&self) -> Result<(), String> {
        if self.description.trim().is_empty() {
            return Err("descrição é obrigatória".into());
        }
        if self.amount <= 0 {
            return Err("valor deve ser maior que zero".into());
        }
        if !(1..=31).contains(&self.day) {
            return Err("dia deve estar entre 1 e 31".into());
        }
        month_str_to_date(&self.start_month)?;
        if let Some(end) = &self.end_month {
            month_str_to_date(end)?;
            if end < &self.start_month {
                return Err("data de fim deve ser posterior ao início".into());
            }
        }
        if let Some(n) = self.installments {
            if n < 2 {
                return Err("quantidade de parcelas deve ser maior ou igual a 2".into());
            }
        }
        Ok(())
    }

    /// Normaliza: parcelas definem end_month; end_month com início no mês 1 do dia 1.
    pub fn normalized(&self) -> Result<Self, String> {
        let mut b = self.clone();
        if let Some(n) = b.installments {
            b.end_month = Some(add_months(&b.start_month, n as u32 - 1));
        }
        Ok(b)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoanInput {
    #[serde(rename = "type")]
    pub type_: i64,
    pub description: String,
    pub principal: i64,
    pub installment: i64,
    pub total_installments: i64,
    pub day: i64,
    pub start_month: String,
    pub payment_method_id: i64,
}

impl LoanInput {
    pub fn validate(&self) -> Result<(), String> {
        if self.description.trim().is_empty() {
            return Err("descrição é obrigatória".into());
        }
        if self.type_ != 1 && self.type_ != 2 {
            return Err("tipo inválido".into());
        }
        if self.principal <= 0 {
            return Err("valor deve ser maior que zero".into());
        }
        if self.installment <= 0 {
            return Err("valor da parcela deve ser maior que zero".into());
        }
        if self.total_installments < 2 {
            return Err("número de parcelas deve ser maior ou igual a 2".into());
        }
        if !(1..=31).contains(&self.day) {
            return Err("dia deve estar entre 1 e 31".into());
        }
        month_str_to_date(&self.start_month)?;
        if self.total_paid() < self.principal {
            return Err("total das parcelas deve ser maior ou igual ao valor".into());
        }
        Ok(())
    }

    pub fn total_paid(&self) -> i64 {
        self.installment * self.total_installments
    }

    pub fn end_month(&self) -> String {
        add_months(&self.start_month, self.total_installments as u32 - 1)
    }
}

// ---- Row DTOs (listas/detalhe) ----

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentMethod {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub type_: i64,
    pub metadata: Option<String>,
}

impl PaymentMethod {
    /// close_day do cartão a partir do metadata JSON, ou None.
    pub fn card_close_day(&self) -> Option<i64> {
        if self.type_ != 2 {
            return None;
        }
        let meta: Option<serde_json::Value> = self
            .metadata
            .as_deref()
            .and_then(|m| serde_json::from_str(m).ok());
        meta.and_then(|v| v.get("close_day")?.as_i64())
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub type_: i64,
    pub color: String,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionRow {
    pub id: i64,
    pub description: String,
    pub amount: i64,
    #[serde(rename = "type")]
    pub type_: i64,
    pub date: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub payment_method_id: Option<i64>,
    pub payment_method_name: Option<String>,
    pub fixed_bill_id: Option<i64>,
    pub loan_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FixedBill {
    pub id: i64,
    pub description: String,
    pub amount: i64,
    pub day: i64,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub payment_method_id: i64,
    pub payment_method_name: String,
    pub start_month: String,
    pub end_month: Option<String>,
    pub installments: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Loan {
    pub id: i64,
    #[serde(rename = "type")]
    pub type_: i64,
    pub description: String,
    pub principal: i64,
    pub installment: i64,
    pub total_installments: i64,
    pub day: i64,
    pub start_month: String,
    pub payment_method_id: i64,
    pub payment_method_name: String,
    pub total_paid: i64,
    pub total_interest: i64,
    pub end_month: String,
    pub paid_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AmortizationRow {
    pub number: i64,
    pub month: String,
    pub installment: i64,
    pub interest: i64,
    pub principal: i64,
    pub balance: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoanDetail {
    pub loan: Loan,
    pub schedule: Vec<AmortizationRow>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakdownRow {
    pub name: String,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardData {
    pub month: String,
    pub income: i64,
    pub expenses: i64,
    pub balance: i64,
    pub prev_balance: i64,
    pub income_by_cat: Vec<BreakdownRow>,
    pub expenses_by_pm: Vec<BreakdownRow>,
}
```

`FixedBillInput::normalized` também deve zerar o dia 1 do mês (não necessário — meses já são "YYYY-MM"). Nota: a regra do Go de normalizar start_month para dia 1 não aplica (só armazenamos mês).

- [ ] **Step 4: Rodar teste e ver passar**

```bash
cd src-tauri && cargo test --test models_test 2>&1 | tail -10
```

Expected: 3 testes `ok`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: DTOs e validacoes"
```

### Task 7: domain.rs — utils de mês, billing period, dashboard queries

**Files:**
- Create: `src-tauri/src/domain.rs`
- Modify: `src-tauri/src/lib.rs` (`pub mod domain;`)

- [ ] **Step 1: Teste que falha**

Create `src-tauri/tests/domain_test.rs`:

```rust
use ajedafinancas_lib::domain::{billing_period, month_range};
use chrono::NaiveDate;

#[test]
fn billing_period_respeita_fechamento_e_clamp() {
    let ref_month = NaiveDate::from_ymd_opt(2026, 3, 1).unwrap();
    let (s, e) = billing_period(10, ref_month);
    assert_eq!(s, NaiveDate::from_ymd_opt(2026, 2, 10).unwrap());
    assert_eq!(e, NaiveDate::from_ymd_opt(2026, 3, 10).unwrap());

    // dia 31 clampado: fev só tem 28, abr 30
    let (s2, e2) = billing_period(31, NaiveDate::from_ymd_opt(2026, 4, 1).unwrap());
    assert_eq!(s2, NaiveDate::from_ymd_opt(2026, 3, 31).unwrap());
    assert_eq!(e2, NaiveDate::from_ymd_opt(2026, 4, 30).unwrap());
}

#[test]
fn month_range_gera_inicio_e_fim() {
    let (s, e) = month_range("2026-01").unwrap();
    assert_eq!(s, NaiveDate::from_ymd_opt(2026, 1, 1).unwrap());
    assert_eq!(e, NaiveDate::from_ymd_opt(2026, 2, 1).unwrap());
    assert!(month_range("abc").is_err());
}
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd src-tauri && cargo test --test domain_test 2>&1 | tail -10
```

Expected: falha — `domain` não existe.

- [ ] **Step 3: Implementar domain.rs (parte 1 — utils)**

```rust
use chrono::{Datelike, Months, NaiveDate};
use rusqlite::Connection;

pub fn parse_month(s: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(&format!("{s}-01"), "%Y-%m-%d")
        .map_err(|_| format!("mês inválido: {s}"))
}

pub fn month_range(month: &str) -> Result<(NaiveDate, NaiveDate), String> {
    let start = parse_month(month)?;
    let end = start.checked_add_months(Months::new(1)).unwrap();
    Ok((start, end))
}

pub fn last_day_of(d: NaiveDate) -> u32 {
    d.with_day(1)
        .unwrap()
        .checked_add_months(Months::new(1))
        .unwrap()
        .pred_opt()
        .unwrap()
        .day()
}

/// Período de fatura do cartão: fechamento do mês anterior até fechamento do mês de referência.
pub fn billing_period(close_day: u32, ref_month: NaiveDate) -> (NaiveDate, NaiveDate) {
    let prev = ref_month.checked_sub_months(Months::new(1)).unwrap();
    let start_day = close_day.min(last_day_of(prev));
    let end_day = close_day.min(last_day_of(ref_month));
    (
        prev.with_day(start_day).unwrap(),
        ref_month.with_day(end_day).unwrap(),
    )
}

pub fn current_month() -> String {
    chrono::Local::now().date_naive().format("%Y-%m").to_string()
}

/// Mês (YYYY-MM) da transação mais antiga, ou mês corrente.
pub fn earliest_month(conn: &Connection) -> Result<String, String> {
    let min: Option<String> = conn
        .query_row("SELECT MIN(date) FROM transactions", [], |r| r.get(0))
        .map(Some)
        .or_else(|_| Ok(None))?;
    Ok(match min {
        Some(d) if d.len() >= 7 => d[..7].to_string(),
        _ => current_month(),
    })
}

fn to_err(e: impl std::fmt::Display) -> String {
    format!("erro de banco de dados: {e}")
}
```

- [ ] **Step 4: Implementar domain.rs (parte 2 — queries do dashboard)**

Adicione ao mesmo arquivo `domain.rs`:

```rust
pub fn month_income(conn: &Connection, start: NaiveDate, end: NaiveDate) -> Result<i64, String> {
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE type = 1 AND date >= ?1 AND date < ?2",
            rusqlite::params![start.format("%Y-%m-%d").to_string(), end.format("%Y-%m-%d").to_string()],
            |r| r.get(0),
        )
        .map_err(to_err)?;
    Ok(v)
}

pub fn pm_expenses(
    conn: &Connection,
    pm_id: i64,
    start: NaiveDate,
    end: NaiveDate,
) -> Result<i64, String> {
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE type = 2 AND payment_method_id = ?1 AND date >= ?2 AND date < ?3",
            rusqlite::params![
                pm_id,
                start.format("%Y-%m-%d").to_string(),
                end.format("%Y-%m-%d").to_string()
            ],
            |r| r.get(0),
        )
        .map_err(to_err)?;
    Ok(v)
}

pub fn no_pm_expenses(conn: &Connection, start: NaiveDate, end: NaiveDate) -> Result<i64, String> {
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE type = 2 AND payment_method_id IS NULL AND date >= ?1 AND date < ?2",
            rusqlite::params![start.format("%Y-%m-%d").to_string(), end.format("%Y-%m-%d").to_string()],
            |r| r.get(0),
        )
        .map_err(to_err)?;
    Ok(v)
}

/// Despesas do mês de referência respeitando billing period de cartões.
pub fn month_expenses(conn: &Connection, ref_month: NaiveDate) -> Result<i64, String> {
    let (start, end) = (ref_month.with_day(1).unwrap(), ref_month.checked_add_months(Months::new(1)).unwrap());
    let mut total = 0;
    let mut stmt = conn
        .prepare("SELECT id, type, metadata FROM payment_methods")
        .map_err(to_err)?;
    let pms = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, Option<String>>(2)?,
            ))
        })
        .map_err(to_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(to_err)?;
    for (id, ty, meta) in pms {
        let mut s = start;
        let mut e = end;
        if ty == 2 {
            let cd: Option<i64> = meta
                .as_deref()
                .and_then(|m| serde_json::from_str::<serde_json::Value>(m).ok())
                .and_then(|v| v.get("close_day")?.as_i64());
            if let Some(cd) = cd {
                if cd > 0 {
                    let (ps, pe) = billing_period(cd as u32, ref_month);
                    s = ps;
                    e = pe;
                }
            }
        }
        total += pm_expenses(conn, id, s, e)?;
    }
    total += no_pm_expenses(conn, start, end)?;
    Ok(total)
}

pub fn income_by_category(conn: &Connection, start: NaiveDate, end: NaiveDate) -> Result<Vec<crate::models::BreakdownRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT COALESCE(c.name, 'Sem categoria') AS name, SUM(t.amount) AS total
             FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
             WHERE t.type = 1 AND t.date >= ?1 AND t.date < ?2
             GROUP BY c.name ORDER BY total DESC",
        )
        .map_err(to_err)?;
    let rows = stmt
        .query_map(
            rusqlite::params![start.format("%Y-%m-%d").to_string(), end.format("%Y-%m-%d").to_string()],
            |r| {
                Ok(crate::models::BreakdownRow {
                    name: r.get(0)?,
                    total: r.get(1)?,
                })
            },
        )
        .map_err(to_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(to_err)?;
    Ok(rows)
}

pub fn expenses_by_pm(conn: &Connection, ref_month: NaiveDate) -> Result<Vec<crate::models::BreakdownRow>, String> {
    let (start, end) = (ref_month.with_day(1).unwrap(), ref_month.checked_add_months(Months::new(1)).unwrap());
    let mut out = Vec::new();
    let mut stmt = conn
        .prepare("SELECT id, name, type, metadata FROM payment_methods ORDER BY name")
        .map_err(to_err)?;
    let pms = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, Option<String>>(3)?,
            ))
        })
        .map_err(to_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(to_err)?;
    for (id, name, ty, meta) in pms {
        let mut s = start;
        let mut e = end;
        if ty == 2 {
            let cd: Option<i64> = meta
                .as_deref()
                .and_then(|m| serde_json::from_str::<serde_json::Value>(m).ok())
                .and_then(|v| v.get("close_day")?.as_i64());
            if let Some(cd) = cd {
                if cd > 0 {
                    let (ps, pe) = billing_period(cd as u32, ref_month);
                    s = ps;
                    e = pe;
                }
            }
        }
        let t = pm_expenses(conn, id, s, e)?;
        if t > 0 {
            out.push(crate::models::BreakdownRow { name, total: t });
        }
    }
    let no_pm = no_pm_expenses(conn, start, end)?;
    if no_pm > 0 {
        out.push(crate::models::BreakdownRow { name: "Sem forma de pagamento".into(), total: no_pm });
    }
    out.sort_by(|a, b| b.total.cmp(&a.total));
    Ok(out)
}
```

- [ ] **Step 5: Rodar testes e ver passar**

```bash
cd src-tauri && cargo test --test domain_test 2>&1 | tail -10
```

Expected: 2 testes `ok` (código de Step 3/4 compila junto; queries não exercitadas ainda).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: utils de mes e queries do dashboard"
```

### Task 8: domain.rs — geração de contas fixas

**Files:**
- Modify: `src-tauri/src/domain.rs`

- [ ] **Step 1: Teste que falha**

Append em `src-tauri/tests/domain_test.rs`:

```rust
use ajedafinancas_lib::db::migrations;
use ajedafinancas_lib::domain;
use rusqlite::Connection;

fn conn() -> Connection {
    let mut c = Connection::open_in_memory().unwrap();
    migrations().to_latest(&mut c).unwrap();
    c
}

#[test]
fn gera_conta_fixa_no_dia_clampado_e_nao_duplica() {
    let c = conn();
    c.execute(
        "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
         VALUES ('Aluguel', 150000, 30, 1, '2025-01', NULL, NULL)",
        [],
    )
    .unwrap();
    let feb = chrono::NaiveDate::from_ymd_opt(2026, 2, 1).unwrap();
    domain::generate_fixed_bills(&c, feb).unwrap();

    let n: i64 = c
        .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
        .unwrap();
    assert_eq!(n, 1);
    let (date, amount): (String, i64) = c
        .query_row("SELECT date, amount FROM transactions LIMIT 1", [], |r| Ok((r.get(0)?, r.get(1)?)))
        .unwrap();
    assert_eq!(date, "2026-02-28", "dia 30 clampado para fevereiro");
    assert_eq!(amount, 150000);

    // rodar de novo no mesmo mês não duplica
    domain::generate_fixed_bills(&c, feb).unwrap();
    let n2: i64 = c
        .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
        .unwrap();
    assert_eq!(n2, 1);
}

#[test]
fn ignora_conta_fixa_fora_do_periodo() {
    let c = conn();
    c.execute(
        "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
         VALUES ('Antiga', 100, 1, 1, '2020-01', '2020-06', NULL)",
        [],
    )
    .unwrap();
    let m = chrono::NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
    domain::generate_fixed_bills(&c, m).unwrap();
    let n: i64 = c
        .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
        .unwrap();
    assert_eq!(n, 0);
}
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd src-tauri && cargo test --test domain_test 2>&1 | tail -10
```

Expected: falha — `generate_fixed_bills` não existe.

- [ ] **Step 3: Implementar**

Append em `domain.rs`:

```rust
/// Gera transações das contas fixas ativas no mês. Dia clampado ao último dia.
pub fn generate_fixed_bills(conn: &Connection, month: NaiveDate) -> Result<(), String> {
    let month_key = month.format("%Y-%m").to_string();
    let mut stmt = conn
        .prepare(
            "SELECT id, description, amount, day, category_id, payment_method_id
             FROM fixed_bills
             WHERE start_month <= ?1 AND (end_month IS NULL OR end_month >= ?1)",
        )
        .map_err(to_err)?;
    let bills = stmt
        .query_map(rusqlite::params![month_key], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, Option<i64>>(4)?,
                r.get::<_, i64>(5)?,
            ))
        })
        .map_err(to_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(to_err)?;

    let start = month.with_day(1).unwrap().format("%Y-%m-%d").to_string();
    let end = month
        .checked_add_months(Months::new(1))
        .unwrap()
        .format("%Y-%m-%d")
        .to_string();
    let due_day = month.day().min(last_day_of(month));

    for (id, description, amount, day, category_id, payment_method_id) in bills {
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE fixed_bill_id = ?1 AND date >= ?2 AND date < ?3",
                rusqlite::params![id, start, end],
                |r| r.get(0),
            )
            .map_err(to_err)?;
        if exists > 0 {
            continue;
        }
        let due_day = day.min(due_day as i64) as u32;
        let due = month.with_day(due_day).unwrap().format("%Y-%m-%d").to_string();
        conn.execute(
            "INSERT INTO transactions (description, amount, type, date, category_id, payment_method_id, fixed_bill_id, loan_id)
             VALUES (?1, ?2, 2, ?3, ?4, ?5, ?6, NULL)",
            rusqlite::params![description, amount, due, category_id, payment_method_id, id],
        )
        .map_err(to_err)?;
    }
    Ok(())
}
```

Nota: `let due_day = day.min(due_day as i64)` clamp diário (Go usa `lastDay` do mês). O due_day é o menor entre o dia da conta e o último dia do mês.

- [ ] **Step 4: Rodar e ver passar**

```bash
cd src-tauri && cargo test --test domain_test 2>&1 | tail -10
```

Expected: 4 testes `ok` (2 antigos + 2 novos).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: geracao de contas fixas"
```

### Task 9: domain.rs — parcelas de empréstimo + sync

**Files:**
- Modify: `src-tauri/src/domain.rs`

- [ ] **Step 1: Teste que falha**

Append em `src-tauri/tests/domain_test.rs`:

```rust
#[test]
fn gera_parcelas_de_emprestimo() {
    let c = conn();
    c.execute(
        "INSERT INTO loans (type, description, principal, installment, total_installments, day, start_month, payment_method_id)
         VALUES (1, 'Empréstimo', 300000, 110000, 3, 15, '2026-01', 1)",
        [],
    )
    .unwrap();

    // mês 1: entrada (receita) + 1ª parcela (despesa)
    domain::generate_loan_installments(&c, chrono::NaiveDate::from_ymd_opt(2026, 1, 1).unwrap()).unwrap();
    let (income, expense): (i64, i64) = c
        .query_row(
            "SELECT SUM(CASE WHEN type=1 THEN 1 ELSE 0 END), SUM(CASE WHEN type=2 THEN 1 ELSE 0 END) FROM transactions",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!((income, expense), (1, 1));
    let desc: String = c
        .query_row("SELECT description FROM transactions WHERE type=1", [], |r| r.get(0))
        .unwrap();
    assert!(desc.contains("(entrada)"));

    // mês 2: só parcela, sem duplicar a entrada
    domain::generate_loan_installments(&c, chrono::NaiveDate::from_ymd_opt(2026, 2, 1).unwrap()).unwrap();
    let total: i64 = c
        .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
        .unwrap();
    assert_eq!(total, 3);
}

#[test]
fn sync_generated_cobre_meses_com_movimento() {
    let c = conn();
    c.execute(
        "INSERT INTO fixed_bills (description, amount, day, payment_method_id, start_month, end_month, installments)
         VALUES ('Conta', 5000, 10, 1, '2025-01', NULL, NULL)",
        [],
    )
    .unwrap();
    // transação manual em 2026-01 (sem conta gerada ainda)
    c.execute(
        "INSERT INTO transactions (description, amount, type, date) VALUES ('Manual', 100, 1, '2026-01-05')",
        [],
    )
    .unwrap();
    domain::sync_generated(&c, chrono::NaiveDate::from_ymd_opt(2026, 2, 1).unwrap()).unwrap();
    let n: i64 = c
        .query_row("SELECT COUNT(*) FROM transactions WHERE fixed_bill_id IS NOT NULL", [], |r| r.get(0))
        .unwrap();
    assert_eq!(n, 1, "conta fixa gerada para 2026-01 (mês com movimento)");
}
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd src-tauri && cargo test --test domain_test 2>&1 | tail -10
```

Expected: falha — `generate_loan_installments` / `sync_generated` não existem.

- [ ] **Step 3: Implementar**

Append em `domain.rs`:

```rust
/// Gera entrada (empréstimos) e parcelas mensais dos empréstimos ativos no mês.
pub fn generate_loan_installments(conn: &Connection, month: NaiveDate) -> Result<(), String> {
    let month_key = month.format("%Y-%m").to_string();
    let start = month.with_day(1).unwrap().format("%Y-%m-%d").to_string();
    let end = month
        .checked_add_months(Months::new(1))
        .unwrap()
        .format("%Y-%m-%d")
        .to_string();

    let mut stmt = conn
        .prepare(
            "SELECT id, type, description, principal, installment, total_installments, day, payment_method_id, start_month
             FROM loans",
        )
        .map_err(to_err)?;
    let loans = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, i64>(5)?,
                r.get::<_, i64>(6)?,
                r.get::<_, i64>(7)?,
                r.get::<_, String>(8)?,
            ))
        })
        .map_err(to_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(to_err)?;

    for (id, ty, description, principal, installment, total_n, day, pm_id, start_month) in loans {
        if start_month > month_key {
            continue;
        }
        let loan_start = parse_month(&start_month).map_err(to_err)?;
        let loan_end = loan_start
            .checked_add_months(Months::new(total_n as u32 - 1))
            .unwrap();
        if loan_end < month {
            continue;
        }

        if ty == 1 {
            let exists: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM transactions WHERE loan_id = ?1 AND type = 1",
                    rusqlite::params![id],
                    |r| r.get(0),
                )
                .map_err(to_err)?;
            if exists == 0 {
                conn.execute(
                    "INSERT INTO transactions (description, amount, type, date, payment_method_id, loan_id)
                     VALUES (?1, ?2, 1, ?3, ?4, ?5)",
                    rusqlite::params![
                        format!("{description} (entrada)"),
                        principal,
                        loan_start.format("%Y-%m-%d").to_string(),
                        pm_id,
                        id
                    ],
                )
                .map_err(to_err)?;
            }
        }

        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE loan_id = ?1 AND type = 2 AND date >= ?2 AND date < ?3",
                rusqlite::params![id, start, end],
                |r| r.get(0),
            )
            .map_err(to_err)?;
        if exists == 0 {
            let due_day = day.min(last_day_of(month) as i64) as u32;
            let due = month.with_day(due_day).unwrap().format("%Y-%m-%d").to_string();
            conn.execute(
                "INSERT INTO transactions (description, amount, type, date, payment_method_id, loan_id)
                 VALUES (?1, ?2, 2, ?3, ?4, ?5)",
                rusqlite::params![description, installment, due, pm_id, id],
            )
            .map_err(to_err)?;
        }
    }
    Ok(())
}

/// Regera contas fixas e parcelas de todos os meses com movimento, do mais antigo ao atual.
pub fn sync_generated(conn: &Connection, now: NaiveDate) -> Result<(), String> {
    let min: Option<String> = conn
        .query_row("SELECT MIN(date) FROM transactions", [], |r| r.get(0))
        .map(Some)
        .or_else(|_| Ok(None))?;
    let Some(min) = min else { return Ok(()); };
    let mut m = parse_month(&min[..7]).map_err(to_err)?;
    while m <= now {
        let start = m.with_day(1).unwrap().format("%Y-%m-%d").to_string();
        let end = m
            .checked_add_months(Months::new(1))
            .unwrap()
            .format("%Y-%m-%d")
            .to_string();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE date >= ?1 AND date < ?2",
                rusqlite::params![start, end],
                |r| r.get(0),
            )
            .map_err(to_err)?;
        if count > 0 {
            generate_fixed_bills(conn, m)?;
            generate_loan_installments(conn, m)?;
        }
        m = m.checked_add_months(Months::new(1)).unwrap();
    }
    Ok(())
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd src-tauri && cargo test --test domain_test 2>&1 | tail -10
```

Expected: 6 testes `ok`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: parcelas de emprestimo e sync de geradas"
```

### Task 10: domain.rs — matemática do empréstimo (taxa + amortização)

**Files:**
- Modify: `src-tauri/src/domain.rs`

- [ ] **Step 1: Teste que falha**

Append em `src-tauri/tests/domain_test.rs`:

```rust
use ajedafinancas_lib::models::LoanInput;

#[test]
fn taxa_mensal_bissecao_reconstroi_fluxo() {
    let l = LoanInput {
        type_: 1,
        description: "x".into(),
        principal: 100_000,
        installment: 35_000,
        total_installments: 3,
        day: 10,
        start_month: "2026-01".into(),
        payment_method_id: Some(1),
    };
    let rate = domain::loan_monthly_rate(l.principal, l.installment, l.total_installments);
    assert!(rate > 0.0 && rate < 0.5, "taxa = {rate}");
    // PV = PMT * (1-(1+i)^-n)/i deve aproximar o principal
    let pv = (l.installment as f64) * (1.0 - (1.0 + rate).powf(-(l.total_installments as f64))) / rate;
    assert!((pv - l.principal as f64).abs() < 1.0, "pv={pv}");

    let zero = domain::loan_monthly_rate(100, 10, 12);
    assert_eq!(zero, 0.0, "total <= principal => taxa 0");
}

#[test]
fn schedule_amortiza_ate_zero() {
    let l = LoanInput {
        type_: 1,
        description: "x".into(),
        principal: 300_000,
        installment: 110_000,
        total_installments: 3,
        day: 15,
        start_month: "2026-01".into(),
        payment_method_id: Some(1),
    };
    let rows = domain::loan_schedule(l.principal, l.installment, l.total_installments, &l.start_month);
    assert_eq!(rows.len() as i64, l.total_installments);
    let sum_principal: i64 = rows.iter().map(|r| r.principal).sum();
    assert_eq!(sum_principal, l.principal, "soma das amortizações = principal");
    assert_eq!(rows.last().unwrap().balance, 0, "saldo final zero");
    assert_eq!(rows[0].month, "2026-01");
    assert_eq!(rows[2].month, "2026-03");
}
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd src-tauri && cargo test --test domain_test 2>&1 | tail -10
```

Expected: falha — `loan_monthly_rate` / `loan_schedule` não existem.

- [ ] **Step 3: Implementar**

Append em `domain.rs`:

```rust
use crate::models::AmortizationRow;

/// Taxa mensal i que resolve PV = PMT * (1-(1+i)^-n)/i por bisseção.
pub fn loan_monthly_rate(principal: i64, installment: i64, n: i64) -> f64 {
    if principal <= 0 || installment <= 0 || n < 1 {
        return 0.0;
    }
    let pv = principal as f64;
    let pmt = installment as f64;
    let n = n as f64;
    if pmt * n <= pv {
        return 0.0;
    }
    let g = |i: f64| pmt * (1.0 - (1.0 + i).powf(-n)) / i - pv;
    let mut lo = 0.0;
    let mut hi = 0.0001;
    while g(hi) > 0.0 && hi < 100.0 {
        hi *= 2.0;
    }
    for _ in 0..200 {
        let mid = (lo + hi) / 2.0;
        if g(mid) > 0.0 {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    (lo + hi) / 2.0
}

/// Tabela de amortização (parcelas iguais, juros sobre saldo devedor).
pub fn loan_schedule(principal: i64, installment: i64, n: i64, start_month: &str) -> Vec<AmortizationRow> {
    let rate = loan_monthly_rate(principal, installment, n);
    let mut balance = principal;
    let mut rows = Vec::with_capacity(n as usize);
    for k in 1..=n {
        let interest = (balance as f64 * rate).round() as i64;
        let mut p = installment - interest;
        let mut paid = installment;
        if k == n {
            p = balance;
            paid = interest + p;
        }
        balance -= p;
        let month = parse_month(start_month)
            .unwrap()
            .checked_add_months(Months::new(k as u32 - 1))
            .unwrap()
            .format("%Y-%m")
            .to_string();
        rows.push(AmortizationRow {
            number: k,
            month,
            installment: paid,
            interest,
            principal: p,
            balance,
        });
    }
    rows
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd src-tauri && cargo test --test domain_test 2>&1 | tail -10
```

Expected: 8 testes `ok`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: taxa mensal e tabela de amortizacao"
```

### Task 11: commands — meta, transactions

**Files:**
- Create: `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/meta.rs`, `src-tauri/src/commands/transactions.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Implementar commands/mod.rs**

```rust
pub mod categories;
pub mod dashboard;
pub mod fixed_bills;
pub mod loans;
pub mod meta;
pub mod payment_methods;
pub mod transactions;
```

- [ ] **Step 2: Implementar meta.rs**

```rust
use crate::db::{with_db, AppState};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn get_earliest_month(state: State<'_, AppState>) -> Result<String, String> {
    with_db(&state, crate::domain::earliest_month)
}

#[tauri::command]
pub fn get_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}
```

- [ ] **Step 3: Implementar transactions.rs**

```rust
use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::{TransactionInput, TransactionRow};
use rusqlite::{params, Connection};
use tauri::State;

#[tauri::command]
pub async fn list_transactions(
    state: State<'_, AppState>,
    month: Option<String>,
) -> Result<Vec<TransactionRow>, String> {
    with_db(&state, |c| list(c, month.as_deref()))
}

fn list(conn: &Connection, month: Option<&str>) -> Result<Vec<TransactionRow>, String> {
    let (start, end) = match month {
        Some(m) if !m.is_empty() => {
            let (s, e) = domain::month_range(m)?;
            (Some(s), Some(e))
        }
        _ => (None, None),
    };
    let mut sql = String::from(
        "SELECT t.id, t.description, t.amount, t.type, t.date,
                t.category_id, c.name, t.payment_method_id, pm.name,
                t.fixed_bill_id, t.loan_id
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id",
    );
    if start.is_some() {
        sql.push_str(" WHERE t.date >= ?1 AND t.date < ?2");
    }
    sql.push_str(" ORDER BY t.date DESC, t.id DESC");
    let mut stmt = conn.prepare(&sql).map_err(domain::db_err)?;
    let rows = stmt
        .query_map(
            params![
                start.map(|d| d.format("%Y-%m-%d").to_string()),
                end.map(|d| d.format("%Y-%m-%d").to_string())
            ],
            |r| {
                Ok(TransactionRow {
                    id: r.get(0)?,
                    description: r.get(1)?,
                    amount: r.get(2)?,
                    type_: r.get(3)?,
                    date: r.get(4)?,
                    category_id: r.get(5)?,
                    category_name: r.get(6)?,
                    payment_method_id: r.get(7)?,
                    payment_method_name: r.get(8)?,
                    fixed_bill_id: r.get(9)?,
                    loan_id: r.get(10)?,
                })
            },
        )
        .map_err(domain::db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(domain::db_err)?;
    Ok(rows)
}

#[tauri::command]
pub async fn create_transaction(
    state: State<'_, AppState>,
    input: TransactionInput,
) -> Result<(), String> {
    input.validate()?;
    with_db(&state, |c| {
        c.execute(
            "INSERT INTO transactions (description, amount, type, date, category_id, payment_method_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                input.description.trim(),
                input.amount,
                input.type_,
                input.date,
                input.category_id,
                input.payment_method_id
            ],
        )
        .map_err(domain::db_err)?;
        Ok(())
    })
}

#[tauri::command]
pub async fn update_transaction(
    state: State<'_, AppState>,
    id: i64,
    input: TransactionInput,
) -> Result<(), String> {
    input.validate()?;
    with_db(&state, |c| {
        let affected = c
            .execute(
                "UPDATE transactions SET description = ?1, amount = ?2, type = ?3, date = ?4,
                        category_id = ?5, payment_method_id = ?6
                 WHERE id = ?7",
                params![
                    input.description.trim(),
                    input.amount,
                    input.type_,
                    input.date,
                    input.category_id,
                    input.payment_method_id,
                    id
                ],
            )
            .map_err(domain::db_err)?;
        if affected == 0 {
            return Err("transação não encontrada".into());
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_transactions(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| delete_ids(c, ids))
}

pub fn delete_ids(conn: &Connection, ids: &[i64]) -> Result<(), String> {
    let placeholders = vec!["?"; ids.len()].join(",");
    let sql = format!("DELETE FROM transactions WHERE id IN ({placeholders})");
    conn.execute(&sql, rusqlite::params_from_iter(ids.iter()))
        .map_err(domain::db_err)?;
    Ok(())
}
```

O código usa `domain::db_err` — adicione em `domain.rs` (apêndice no final do arquivo):

```rust
pub fn db_err(e: impl std::fmt::Display) -> String {
    format!("erro de banco de dados: {e}")
}
```

E remova o `fn to_err` duplicado de `domain.rs` (ou mantenha só `db_err` e troque as chamadas). Para simplicidade, troque todos os usos de `to_err` por `db_err` no `domain.rs` (search/replace) e apague `to_err`.

- [ ] **Step 4: Registrar comandos no lib.rs**

Modifique `src-tauri/src/lib.rs`: adicione `mod commands;` e substitua o `invoke_handler`:

```rust
.invoke_handler(tauri::generate_handler![
    commands::meta::get_earliest_month,
    commands::meta::get_version,
    commands::dashboard::get_dashboard,
    commands::dashboard::sync_dashboard,
    commands::transactions::list_transactions,
    commands::transactions::create_transaction,
    commands::transactions::update_transaction,
    commands::transactions::delete_transactions,
    commands::payment_methods::list_payment_methods,
    commands::payment_methods::create_payment_method,
    commands::payment_methods::update_payment_method,
    commands::payment_methods::delete_payment_methods,
    commands::categories::list_categories,
    commands::categories::create_category,
    commands::categories::update_category,
    commands::categories::delete_categories,
    commands::fixed_bills::list_fixed_bills,
    commands::fixed_bills::create_fixed_bill,
    commands::fixed_bills::update_fixed_bill,
    commands::fixed_bills::delete_fixed_bills,
    commands::loans::list_loans,
    commands::loans::get_loan_detail,
    commands::loans::create_loan,
    commands::loans::update_loan,
    commands::loans::delete_loans,
])
```

Os módulos `payment_methods`, `categories`, `fixed_bills`, `loans`, `dashboard` ainda não existem — crie stubs vazios em `commands/` para compilar:

```rust
// commands/payment_methods.rs (stub)
// preenchido na Task 12
```

Ou implemente o restante nas Tasks 12–15 antes de rodar `cargo check`. Faça a ordem abaixo: primeiro crie stubs vazios (`pub mod x {}` não funciona — crie arquivos com `// stub` vazio) para `cargo check` passar, depois preencha.

- [ ] **Step 5: Compilar**

```bash
cd src-tauri && cargo check 2>&1 | tail -15
```

Expected: compila (stubs vazios nos módulos restantes). Rode `cargo test` — testes de domain/models continuam `ok`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: comandos de transacoes e meta"
```

### Task 12: commands — payment_methods, categories

**Files:**
- Create: `src-tauri/src/commands/payment_methods.rs`, `src-tauri/src/commands/categories.rs`
- Modify: `src-tauri/src/models.rs` (helper `card_metadata`)

- [ ] **Step 1: Implementar payment_methods.rs**

```rust
use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::{PaymentMethod, PaymentMethodInput};
use rusqlite::{params, Connection};
use tauri::State;

#[tauri::command]
pub async fn list_payment_methods(state: State<'_, AppState>) -> Result<Vec<PaymentMethod>, String> {
    with_db(&state, list)
}

fn list(conn: &Connection) -> Result<Vec<PaymentMethod>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, type, metadata FROM payment_methods ORDER BY name")
        .map_err(domain::db_err)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(PaymentMethod {
                id: r.get(0)?,
                name: r.get(1)?,
                type_: r.get(2)?,
                metadata: r.get(3)?,
            })
        })
        .map_err(domain::db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(domain::db_err)?;
    Ok(rows)
}

fn metadata_for(input: &PaymentMethodInput) -> Option<String> {
    if input.type_ != 2 {
        return None;
    }
    let close = input.close_day.unwrap_or(0);
    let validity = input.validity_day.unwrap_or(0);
    Some(
        serde_json::json!({ "close_day": close, "validity_day": validity }).to_string(),
    )
}

fn validate(input: &PaymentMethodInput) -> Result<(), String> {
    if input.name.trim().is_empty() {
        return Err("nome é obrigatório".into());
    }
    if input.type_ != 1 && input.type_ != 2 {
        return Err("tipo inválido".into());
    }
    if let Some(d) = input.close_day {
        if !(1..=31).contains(&d) {
            return Err("dia de fechamento deve estar entre 1 e 31".into());
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn create_payment_method(
    state: State<'_, AppState>,
    input: PaymentMethodInput,
) -> Result<(), String> {
    validate(&input)?;
    with_db(&state, |c| {
        c.execute(
            "INSERT INTO payment_methods (name, type, metadata) VALUES (?1, ?2, ?3)",
            params![input.name.trim(), input.type_, metadata_for(&input)],
        )
        .map_err(domain::db_err)?;
        Ok(())
    })
}

#[tauri::command]
pub async fn update_payment_method(
    state: State<'_, AppState>,
    id: i64,
    input: PaymentMethodInput,
) -> Result<(), String> {
    validate(&input)?;
    with_db(&state, |c| {
        let affected = c
            .execute(
                "UPDATE payment_methods SET name = ?1, type = ?2, metadata = ?3 WHERE id = ?4",
                params![input.name.trim(), input.type_, metadata_for(&input), id],
            )
            .map_err(domain::db_err)?;
        if affected == 0 {
            return Err("forma de pagamento não encontrada".into());
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_payment_methods(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| {
        let placeholders = vec!["?"; ids.len()].join(",");
        c.execute(
            &format!("DELETE FROM payment_methods WHERE id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(domain::db_err)?;
        Ok(())
    })
}
```

Nota: apagar forma de pagamento usada em transações falha (FK RESTRICT). O Go permitia via soft delete? GORM delete físico com FK... O Go não tinha FK constraint explícita no sqlite (GORM cria, mas sqlite precisa PRAGMA foreign_keys ON que o driver do GORM liga). Se quiser comportamento leniente, ignore — RESTRICT é mais seguro. Comentário `// ponytail: FK RESTRICT bloqueia delete em uso; upgrade p/ SET NULL se UX pedir`.

- [ ] **Step 2: Implementar categories.rs**

```rust
use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::{Category, CategoryInput};
use rusqlite::{params, Connection};
use tauri::State;

#[tauri::command]
pub async fn list_categories(state: State<'_, AppState>) -> Result<Vec<Category>, String> {
    with_db(&state, list)
}

fn list(conn: &Connection) -> Result<Vec<Category>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, type, color, icon FROM categories ORDER BY name")
        .map_err(domain::db_err)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Category {
                id: r.get(0)?,
                name: r.get(1)?,
                type_: r.get(2)?,
                color: r.get(3)?,
                icon: r.get(4)?,
            })
        })
        .map_err(domain::db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(domain::db_err)?;
    Ok(rows)
}

fn validate(input: &CategoryInput) -> Result<(), String> {
    if input.name.trim().is_empty() {
        return Err("nome é obrigatório".into());
    }
    if input.type_ != 1 && input.type_ != 2 {
        return Err("tipo inválido".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn create_category(state: State<'_, AppState>, input: CategoryInput) -> Result<(), String> {
    validate(&input)?;
    with_db(&state, |c| {
        c.execute(
            "INSERT INTO categories (name, type, color, icon) VALUES (?1, ?2, ?3, ?4)",
            params![input.name.trim(), input.type_, input.color, input.icon],
        )
        .map_err(domain::db_err)?;
        Ok(())
    })
}

#[tauri::command]
pub async fn update_category(
    state: State<'_, AppState>,
    id: i64,
    input: CategoryInput,
) -> Result<(), String> {
    validate(&input)?;
    with_db(&state, |c| {
        let affected = c
            .execute(
                "UPDATE categories SET name = ?1, type = ?2, color = ?3, icon = ?4 WHERE id = ?5",
                params![input.name.trim(), input.type_, input.color, input.icon, id],
            )
            .map_err(domain::db_err)?;
        if affected == 0 {
            return Err("categoria não encontrada".into());
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_categories(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| {
        let placeholders = vec!["?"; ids.len()].join(",");
        c.execute(
            &format!("DELETE FROM categories WHERE id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(domain::db_err)?;
        Ok(())
    })
}
```

- [ ] **Step 3: Compilar e testar**

```bash
cd src-tauri && cargo check 2>&1 | tail -15 && cargo test 2>&1 | tail -8
```

Expected: compila; testes todos `ok`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: comandos de formas de pagamento e categorias"
```

### Task 13: commands — fixed_bills

**Files:**
- Create: `src-tauri/src/commands/fixed_bills.rs`

- [ ] **Step 1: Implementar**

```rust
use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::{FixedBill, FixedBillInput};
use rusqlite::{params, Connection};
use tauri::State;

#[tauri::command]
pub async fn list_fixed_bills(
    state: State<'_, AppState>,
    only_installments: bool,
) -> Result<Vec<FixedBill>, String> {
    with_db(&state, |c| list(c, only_installments))
}

fn list(conn: &Connection, only_installments: bool) -> Result<Vec<FixedBill>, String> {
    let (cond, order) = if only_installments {
        ("installments IS NOT NULL", "start_month DESC, id DESC")
    } else {
        ("installments IS NULL", "start_month ASC, id ASC")
    };
    let sql = format!(
        "SELECT b.id, b.description, b.amount, b.day, b.category_id, c.name,
                b.payment_method_id, pm.name, b.start_month, b.end_month, b.installments
         FROM fixed_bills b
         LEFT JOIN categories c ON c.id = b.category_id
         JOIN payment_methods pm ON pm.id = b.payment_method_id
         WHERE {cond}
         ORDER BY {order}"
    );
    let mut stmt = conn.prepare(&sql).map_err(domain::db_err)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(FixedBill {
                id: r.get(0)?,
                description: r.get(1)?,
                amount: r.get(2)?,
                day: r.get(3)?,
                category_id: r.get(4)?,
                category_name: r.get(5)?,
                payment_method_id: r.get(6)?,
                payment_method_name: r.get(7)?,
                start_month: r.get(8)?,
                end_month: r.get(9)?,
                installments: r.get(10)?,
            })
        })
        .map_err(domain::db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(domain::db_err)?;
    Ok(rows)
}

/// Se a forma de pagamento é cartão com dia de fechamento, o dia da conta vira o de fechamento.
fn apply_card_day(conn: &Connection, input: &mut FixedBillInput) -> Result<(), String> {
    let pm: Option<(i64, Option<String>)> = conn
        .query_row(
            "SELECT type, metadata FROM payment_methods WHERE id = ?1",
            params![input.payment_method_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map(Some)
        .or_else(|_| Ok(None))?;
    if let Some((ty, meta)) = pm {
        if ty == 2 {
            let cd: Option<i64> = meta
                .as_deref()
                .and_then(|m| serde_json::from_str::<serde_json::Value>(m).ok())
                .and_then(|v| v.get("close_day")?.as_i64());
            if let Some(cd) = cd {
                if cd > 0 {
                    input.day = cd;
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn create_fixed_bill(
    state: State<'_, AppState>,
    mut input: FixedBillInput,
) -> Result<(), String> {
    if input.installments.is_some() {
        input = input.normalized()?;
    }
    input.validate()?;
    with_db(&state, |c| {
        apply_card_day(c, &mut input)?;
        let end_month = input.end_month.clone();
        c.execute(
            "INSERT INTO fixed_bills (description, amount, day, category_id, payment_method_id, start_month, end_month, installments)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                input.description.trim(),
                input.amount,
                input.day,
                input.category_id,
                input.payment_method_id,
                input.start_month,
                end_month,
                input.installments
            ],
        )
        .map_err(domain::db_err)?;
        Ok(())
    })
}

#[tauri::command]
pub async fn update_fixed_bill(
    state: State<'_, AppState>,
    id: i64,
    mut input: FixedBillInput,
) -> Result<(), String> {
    if input.installments.is_some() {
        input = input.normalized()?;
    }
    input.validate()?;
    with_db(&state, |c| {
        apply_card_day(c, &mut input)?;
        let affected = c
            .execute(
                "UPDATE fixed_bills SET description = ?1, amount = ?2, day = ?3, category_id = ?4,
                        payment_method_id = ?5, start_month = ?6, end_month = ?7, installments = ?8
                 WHERE id = ?9",
                params![
                    input.description.trim(),
                    input.amount,
                    input.day,
                    input.category_id,
                    input.payment_method_id,
                    input.start_month,
                    input.end_month,
                    input.installments,
                    id
                ],
            )
            .map_err(domain::db_err)?;
        if affected == 0 {
            return Err("conta fixa não encontrada".into());
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_fixed_bills(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| {
        let placeholders = vec!["?"; ids.len()].join(",");
        c.execute(
            &format!("DELETE FROM transactions WHERE fixed_bill_id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(domain::db_err)?;
        c.execute(
            &format!("DELETE FROM fixed_bills WHERE id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(domain::db_err)?;
        Ok(())
    })
}
```

- [ ] **Step 2: Compilar**

```bash
cd src-tauri && cargo check 2>&1 | tail -15
```

Expected: compila.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: comandos de contas fixas"
```

### Task 14: commands — loans

**Files:**
- Create: `src-tauri/src/commands/loans.rs`

- [ ] **Step 1: Implementar**

```rust
use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::{Loan, LoanDetail, LoanInput};
use rusqlite::{params, Connection};
use tauri::State;

#[tauri::command]
pub async fn list_loans(state: State<'_, AppState>) -> Result<Vec<Loan>, String> {
    with_db(&state, list)
}

fn list(conn: &Connection) -> Result<Vec<Loan>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT l.id, l.type, l.description, l.principal, l.installment,
                    l.total_installments, l.day, l.start_month, l.payment_method_id, pm.name
             FROM loans l JOIN payment_methods pm ON pm.id = l.payment_method_id
             ORDER BY l.start_month DESC, l.id DESC",
        )
        .map_err(domain::db_err)?;
    let raw = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, i64>(5)?,
                r.get::<_, i64>(6)?,
                r.get::<_, String>(7)?,
                r.get::<_, i64>(8)?,
                r.get::<_, String>(9)?,
            ))
        })
        .map_err(domain::db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(domain::db_err)?;

    let mut out = Vec::with_capacity(raw.len());
    for (id, ty, description, principal, installment, total_n, day, start_month, pm_id, pm_name) in raw {
        let paid_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE loan_id = ?1 AND type = 2",
                params![id],
                |r| r.get(0),
            )
            .map_err(domain::db_err)?;
        out.push(Loan {
            id,
            type_: ty,
            description,
            principal,
            installment,
            total_installments: total_n,
            day,
            start_month: start_month.clone(),
            payment_method_id: pm_id,
            payment_method_name: pm_name,
            total_paid: installment * total_n,
            total_interest: installment * total_n - principal,
            end_month: LoanInput {
                type_: ty,
                description,
                principal,
                installment,
                total_installments: total_n,
                day,
                start_month,
                payment_method_id: pm_id,
            }
            .end_month(),
            paid_count,
        });
    }
    Ok(out)
}

fn build(input: &LoanInput) -> crate::models::Loan {
    crate::models::Loan {
        id: 0,
        type_: input.type_,
        description: input.description.clone(),
        principal: input.principal,
        installment: input.installment,
        total_installments: input.total_installments,
        day: input.day,
        start_month: input.start_month.clone(),
        payment_method_id: input.payment_method_id,
        payment_method_name: String::new(),
        total_paid: input.total_paid(),
        total_interest: input.total_paid() - input.principal,
        end_month: input.end_month(),
        paid_count: 0,
    }
}

#[tauri::command]
pub async fn get_loan_detail(state: State<'_, AppState>, id: i64) -> Result<LoanDetail, String> {
    with_db(&state, |c| {
        let raw: Option<(i64, i64, String, i64, i64, i64, i64, String, i64, String)> = c
            .query_row(
                "SELECT l.id, l.type, l.description, l.principal, l.installment,
                        l.total_installments, l.day, l.start_month, l.payment_method_id, pm.name
                 FROM loans l JOIN payment_methods pm ON pm.id = l.payment_method_id
                 WHERE l.id = ?1",
                params![id],
                |r| {
                    Ok((
                        r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?,
                        r.get(5)?, r.get(6)?, r.get(7)?, r.get(8)?, r.get(9)?,
                    ))
                },
            )
            .map(Some)
            .or_else(|_| Ok(None))?;
        let Some((id, ty, description, principal, installment, total_n, day, start_month, pm_id, pm_name)) = raw else {
            return Err("empréstimo não encontrado".into());
        };
        let input = LoanInput {
            type_: ty,
            description,
            principal,
            installment,
            total_installments: total_n,
            day,
            start_month: start_month.clone(),
            payment_method_id: pm_id,
        };
        let loan = build(&input);
        let loan = crate::models::Loan {
            payment_method_name: pm_name,
            paid_count: c
                .query_row(
                    "SELECT COUNT(*) FROM transactions WHERE loan_id = ?1 AND type = 2",
                    params![id],
                    |r| r.get(0),
                )
                .map_err(domain::db_err)?,
            ..loan
        };
        let schedule = domain::loan_schedule(input.principal, input.installment, input.total_installments, &input.start_month);
        Ok(LoanDetail { loan, schedule })
    })
}

#[tauri::command]
pub async fn create_loan(state: State<'_, AppState>, input: LoanInput) -> Result<(), String> {
    input.validate()?;
    with_db(&state, |c| {
        c.execute(
            "INSERT INTO loans (type, description, principal, installment, total_installments, day, start_month, payment_method_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                input.type_,
                input.description.trim(),
                input.principal,
                input.installment,
                input.total_installments,
                input.day,
                input.start_month,
                input.payment_method_id
            ],
        )
        .map_err(domain::db_err)?;
        Ok(())
    })
}

#[tauri::command]
pub async fn update_loan(
    state: State<'_, AppState>,
    id: i64,
    input: LoanInput,
) -> Result<(), String> {
    input.validate()?;
    with_db(&state, |c| {
        let affected = c
            .execute(
                "UPDATE loans SET type = ?1, description = ?2, principal = ?3, installment = ?4,
                        total_installments = ?5, day = ?6, start_month = ?7, payment_method_id = ?8
                 WHERE id = ?9",
                params![
                    input.type_,
                    input.description.trim(),
                    input.principal,
                    input.installment,
                    input.total_installments,
                    input.day,
                    input.start_month,
                    input.payment_method_id,
                    id
                ],
            )
            .map_err(domain::db_err)?;
        if affected == 0 {
            return Err("empréstimo não encontrado".into());
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_loans(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| {
        let placeholders = vec!["?"; ids.len()].join(",");
        c.execute(
            &format!("DELETE FROM transactions WHERE loan_id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(domain::db_err)?;
        c.execute(
            &format!("DELETE FROM loans WHERE id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(domain::db_err)?;
        Ok(())
    })
}
```

- [ ] **Step 2: Compilar**

```bash
cd src-tauri && cargo check 2>&1 | tail -15
```

Expected: compila.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: comandos de emprestimos"
```

### Task 15: commands — dashboard

**Files:**
- Create: `src-tauri/src/commands/dashboard.rs`

- [ ] **Step 1: Implementar**

```rust
use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::DashboardData;
use chrono::Months;
use tauri::State;

fn build(conn: &rusqlite::Connection, month: &str) -> Result<DashboardData, String> {
    let ref_month = domain::parse_month(month)?;
    let prev = ref_month.checked_sub_months(Months::new(1)).unwrap();

    domain::generate_fixed_bills(conn, ref_month)?;
    domain::generate_loan_installments(conn, ref_month)?;

    let income = domain::month_income(conn, ref_month, ref_month.checked_add_months(Months::new(1)).unwrap())?;
    let expenses = domain::month_expenses(conn, ref_month)?;
    let prev_income = domain::month_income(conn, prev, ref_month)?;
    let prev_expenses = domain::month_expenses(conn, prev)?;

    let income_by_cat = domain::income_by_category(
        conn,
        ref_month,
        ref_month.checked_add_months(Months::new(1)).unwrap(),
    )?;
    let expenses_by_pm = domain::expenses_by_pm(conn, ref_month)?;

    Ok(DashboardData {
        month: month.to_string(),
        income,
        expenses,
        balance: (prev_income - prev_expenses) + (income - expenses),
        prev_balance: prev_income - prev_expenses,
        income_by_cat,
        expenses_by_pm,
    })
}

#[tauri::command]
pub async fn get_dashboard(state: State<'_, AppState>, month: String) -> Result<DashboardData, String> {
    with_db(&state, |c| build(c, &month))
}

#[tauri::command]
pub async fn sync_dashboard(state: State<'_, AppState>, month: String) -> Result<DashboardData, String> {
    let now = chrono::Local::now().date_naive();
    with_db(&state, |c| {
        domain::sync_generated(c, now)?;
        build(c, &month)
    })
}
```

- [ ] **Step 2: Compilar e rodar todos os testes**

```bash
cd src-tauri && cargo check 2>&1 | tail -10 && cargo test 2>&1 | tail -8
```

Expected: compila; testes todos `ok` (count de testes ≥ 8).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: comando de dashboard"
```

### Task 16: rodar lint/clippy do backend

- [ ] **Step 1: Clippy**

```bash
cd src-tauri && cargo clippy --all-targets 2>&1 | tail -20
```

Expected: sem `error` (warnings aceitáveis; corrija warnings de `unused` se houver). Corrija qualquer erro e rode de novo.

- [ ] **Step 2: Testes finais**

```bash
cd src-tauri && cargo test 2>&1 | tail -6
```

Expected: `test result: ok` em todos.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: clippy no backend"
```

---

## Fase 2 — Frontend

### Task 17: componentes shadcn e limpeza do starter

**Files:**
- Add: `src/components/ui/*` (shadcn)

- [ ] **Step 1: Adicionar componentes shadcn**

```bash
cd /home/daniel/Projects/AjudaFinancasTauri
bunx shadcn@latest add button input label dialog checkbox table card badge dropdown-menu sonner
bun add lucide-react
```

Se `lucide-react` já existir (template), pule o `bun add`.

Expected: gera `src/components/ui/{button,input,label,dialog,checkbox,table,card,badge,dropdown-menu,sonner}.tsx` e atualiza `components.json`.

- [ ] **Step 2: Remover starter dashboard e invoke example (se presentes)**

O template Next vem com `dashboard-01` e página de exemplo. Remova o conteúdo de exemplo de `src/app/page.tsx` (vira o dashboard real na Task 22) e, se houver, arquivos de exemplo do invoke (`src/components/*-example*`, `src-tauri/src/...` ex. `greet`). Verifique com:

```bash
bunx tsc --noEmit 2>&1 | head -20
```

Expected: sem erros de tipo (ou apenas erros de imports que serão removidos).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: componentes shadcn e limpeza starter"
```

### Task 18: lib — tipos, api, format, month-context

**Files:**
- Create: `src/lib/types.ts`, `src/lib/api.ts`, `src/lib/format.ts`, `src/lib/month-context.tsx`

- [ ] **Step 1: Escrever types.ts**

```ts
export interface PaymentMethod {
  id: number;
  name: string;
  type: 1 | 2;
  metadata: string | null;
}

export interface Category {
  id: number;
  name: string;
  type: 1 | 2;
  color: string;
  icon: string | null;
}

export interface TransactionRow {
  id: number;
  description: string;
  amount: number;
  type: 1 | 2;
  date: string;
  category_id: number | null;
  category_name: string | null;
  payment_method_id: number | null;
  payment_method_name: string | null;
  fixed_bill_id: number | null;
  loan_id: number | null;
}

export interface TransactionInput {
  description: string;
  amount: number;
  type: 1 | 2;
  date: string;
  category_id: number | null;
  payment_method_id: number | null;
}

export interface PaymentMethodInput {
  name: string;
  type: 1 | 2;
  close_day: number | null;
  validity_day: number | null;
}

export interface CategoryInput {
  name: string;
  type: 1 | 2;
  color: string;
  icon: string | null;
}

export interface FixedBill {
  id: number;
  description: string;
  amount: number;
  day: number;
  category_id: number | null;
  category_name: string | null;
  payment_method_id: number;
  payment_method_name: string;
  start_month: string;
  end_month: string | null;
  installments: number | null;
}

export interface FixedBillInput {
  description: string;
  amount: number;
  day: number;
  category_id: number | null;
  payment_method_id: number;
  start_month: string;
  end_month: string | null;
  installments: number | null;
}

export interface Loan {
  id: number;
  type: 1 | 2;
  description: string;
  principal: number;
  installment: number;
  total_installments: number;
  day: number;
  start_month: string;
  payment_method_id: number;
  payment_method_name: string;
  total_paid: number;
  total_interest: number;
  end_month: string;
  paid_count: number;
}

export interface LoanInput {
  type: 1 | 2;
  description: string;
  principal: number;
  installment: number;
  total_installments: number;
  day: number;
  start_month: string;
  payment_method_id: number;
}

export interface AmortizationRow {
  number: number;
  month: string;
  installment: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface LoanDetail {
  loan: Loan;
  schedule: AmortizationRow[];
}

export interface BreakdownRow {
  name: string;
  total: number;
}

export interface DashboardData {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  prev_balance: number;
  income_by_cat: BreakdownRow[];
  expenses_by_pm: BreakdownRow[];
}
```

- [ ] **Step 2: Escrever api.ts**

```ts
import { invoke } from "@tauri-apps/api/core";
import type {
  Category, CategoryInput, DashboardData, FixedBill, FixedBillInput, Loan,
  LoanDetail, LoanInput, PaymentMethod, PaymentMethodInput, TransactionInput, TransactionRow,
} from "./types";

export const api = {
  getEarliestMonth: () => invoke<string>("get_earliest_month"),
  getVersion: () => invoke<string>("get_version"),
  getDashboard: (month: string) => invoke<DashboardData>("get_dashboard", { month }),
  syncDashboard: (month: string) => invoke<DashboardData>("sync_dashboard", { month }),
  listTransactions: (month: string | null) =>
    invoke<TransactionRow[]>("list_transactions", { month }),
  createTransaction: (input: TransactionInput) =>
    invoke<void>("create_transaction", { input }),
  updateTransaction: (id: number, input: TransactionInput) =>
    invoke<void>("update_transaction", { id, input }),
  deleteTransactions: (ids: number[]) =>
    invoke<void>("delete_transactions", { ids }),
  listPaymentMethods: () => invoke<PaymentMethod[]>("list_payment_methods"),
  createPaymentMethod: (input: PaymentMethodInput) =>
    invoke<void>("create_payment_method", { input }),
  updatePaymentMethod: (id: number, input: PaymentMethodInput) =>
    invoke<void>("update_payment_method", { id, input }),
  deletePaymentMethods: (ids: number[]) =>
    invoke<void>("delete_payment_methods", { ids }),
  listCategories: () => invoke<Category[]>("list_categories"),
  createCategory: (input: CategoryInput) => invoke<void>("create_category", { input }),
  updateCategory: (id: number, input: CategoryInput) =>
    invoke<void>("update_category", { id, input }),
  deleteCategories: (ids: number[]) => invoke<void>("delete_categories", { ids }),
  listFixedBills: (onlyInstallments: boolean) =>
    invoke<FixedBill[]>("list_fixed_bills", { onlyInstallments }),
  createFixedBill: (input: FixedBillInput) => invoke<void>("create_fixed_bill", { input }),
  updateFixedBill: (id: number, input: FixedBillInput) =>
    invoke<void>("update_fixed_bill", { id, input }),
  deleteFixedBills: (ids: number[]) => invoke<void>("delete_fixed_bills", { ids }),
  listLoans: () => invoke<Loan[]>("list_loans"),
  getLoanDetail: (id: number) => invoke<LoanDetail>("get_loan_detail", { id }),
  createLoan: (input: LoanInput) => invoke<void>("create_loan", { input }),
  updateLoan: (id: number, input: LoanInput) => invoke<void>("update_loan", { id, input }),
  deleteLoans: (ids: number[]) => invoke<void>("delete_loans", { ids }),
};

export function msg(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : "Erro desconhecido";
}
```

- [ ] **Step 3: Escrever format.ts**

```ts
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatMoney(cents: number): string {
  return brl.format(cents / 100);
}

export function toCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

const months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

export function formatMonth(ym: string | null): string {
  if (!ym) return "Selecione";
  const [y, m] = ym.split("-");
  return `${months[Number(m) - 1] || ""}/${y}`;
}

export function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
```

- [ ] **Step 4: Escrever month-context.tsx**

```tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

interface MonthCtx {
  month: string;
  setMonth: (m: string) => void;
  min: string;
}

const Ctx = createContext<MonthCtx>({ month: "", setMonth: () => {}, min: "" });

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const today = new Date().toISOString().slice(0, 7);
  const [month, setMonthState] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("filterMonth") || today
      : today
  );
  const [min, setMin] = useState(today);

  useEffect(() => {
    api.getEarliestMonth().then(setMin).catch(() => {});
  }, []);

  const setMonth = (m: string) => {
    setMonthState(m);
    localStorage.setItem("filterMonth", m);
  };

  return <Ctx.Provider value={{ month, setMonth, min }}>{children}</Ctx.Provider>;
}

export const useMonth = () => useContext(Ctx);
```

- [ ] **Step 5: Verificar tipos**

```bash
bunx tsc --noEmit 2>&1 | head -20
```

Expected: sem erros novos (ignorar erros pré-existentes de starter não removidos).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: lib de tipos, api, format e contexto de mes"
```

### Task 19: componentes compartilhados — MonthPicker, ConfirmDialog, DataTable

**Files:**
- Create: `src/components/MonthPicker.tsx`, `src/components/confirm.tsx`, `src/components/crud/DataTable.tsx`

- [ ] **Step 1: Escrever MonthPicker.tsx**

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

export function MonthPicker({
  value, onChange, min,
}: { value: string; onChange: (v: string) => void; min?: string }) {
  const [year, setYear] = useState(() => Number((value || new Date().toISOString().slice(0,7)).slice(0,4)));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span>{formatMonth(value)}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="flex items-center justify-between px-2 pt-2">
          <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{year}</span>
          <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-1 p-2">
          {MONTHS.map((m, i) => {
            const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
            const disabled = min ? ym < min : false;
            return (
              <button
                key={m}
                disabled={disabled}
                onClick={() => onChange(ym)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-40",
                  ym === value && "bg-primary text-primary-foreground"
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

`cn` vem de `src/lib/utils.ts` (o shadcn init gera). Se o template não tiver, crie:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

e `bun add clsx tailwind-merge` se ausentes.

- [ ] **Step 2: Escrever confirm.tsx**

```tsx
"use client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open, message, onOpenChange, onConfirm,
}: { open: boolean; message: string; onOpenChange: (o: boolean) => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar exclusão</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Escrever DataTable.tsx**

```tsx
"use client";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Column } from "./CrudPage";

export function DataTable<T extends { id: number }>({
  columns, rows, selected, onToggle,
}: {
  columns: Column<T>[];
  rows: T[];
  selected: Set<number>;
  onToggle: (id: number) => void;
}) {
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox checked={allChecked} onCheckedChange={() => {
              rows.forEach((r) => onToggle(r.id));
            }} />
          </TableHead>
          {columns.map((c) => (
            <TableHead key={c.header} className={c.className}>{c.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={columns.length + 1} className="h-24 text-center text-muted-foreground">
              Nenhum registro
            </TableCell>
          </TableRow>
        )}
        {rows.map((row) => (
          <TableRow key={row.id} className="cursor-pointer" onClick={() => onToggle(row.id)}>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={selected.has(row.id)} onCheckedChange={() => onToggle(row.id)} />
            </TableCell>
            {columns.map((c) => (
              <TableCell key={c.header} className={c.className}>{c.render(row)}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Verificar tipos e commit**

```bash
bunx tsc --noEmit 2>&1 | head -20
git add -A && git commit -m "feat: month picker, confirm dialog e datatable"
```

Nota: `CrudPage.tsx` não existe ainda — o `import type { Column }` quebra o tsc. Crie o arquivo `src/components/crud/CrudPage.tsx` na Task 20 antes de rodar tsc, ou mova a definição de `Column` para `src/components/crud/types.ts` agora. **Recomendado:** crie `src/components/crud/types.ts`:

```ts
import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}
```

E em DataTable: `import type { Column } from "./types";`. Ajuste no Step 3.

- [ ] **Step 5: Commit (se Step 4 não cobriu)**

```bash
git add -A && git commit -m "fix: coluna tipada em types do crud"
```

### Task 20: CrudPage + FormDialog (CRUD genérico)

**Files:**
- Create: `src/components/crud/CrudPage.tsx`, `src/components/crud/FormDialog.tsx`

- [ ] **Step 1: Escrever CrudPage.tsx**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm";
import { DataTable } from "./DataTable";
import { FormDialog } from "./FormDialog";
import type { Column } from "./types";
import { msg } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface CrudConfig<T extends { id: number }, F, E> {
  title: string;
  description?: string;
  columns: Column<T>[];
  pageSize?: number;
  keepOpen?: boolean;
  load: () => Promise<T[]>;
  create: (data: F) => Promise<void>;
  update: (id: number, data: F) => Promise<void>;
  remove: (ids: number[]) => Promise<void>;
  empty: () => F;
  toInput: (row: T) => F;
  loadResources: () => Promise<E>;
  FormFields: React.ComponentType<{
    value: F;
    onChange: (v: F) => void;
    resources: E;
    error: string | null;
  }>;
  reloadKey?: unknown;
}

type DialogState<T, F> = { mode: "create" } | { mode: "edit"; row: T; input: F };

export function CrudPage<T extends { id: number }, F, E>({ config }: { config: CrudConfig<T, F, E> }) {
  const [rows, setRows] = useState<T[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState<DialogState<T, F> | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; ids: number[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const pageSize = config.pageSize ?? 25;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await config.load());
      setSelected(new Set());
      setPage(1);
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    void reload();
  }, [reload, config.reloadKey]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const askDelete = () => {
    const ids = [...selected];
    setConfirm({
      ids,
      message: ids.length === 1 ? "Excluir este registro?" : `Excluir ${ids.length} registros?`,
    });
  };

  const doDelete = async () => {
    if (!confirm) return;
    try {
      await config.remove(confirm.ids);
      toast.success("Excluído com sucesso");
      void reload();
    } catch (e) {
      toast.error(msg(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
          {config.description && (
            <p className="text-sm text-muted-foreground">{config.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void reload()} disabled={loading}>
            Atualizar
          </Button>
          <Button
            variant="outline"
            disabled={selected.size !== 1}
            onClick={() => {
              const row = rows.find((r) => r.id === [...selected][0])!;
              setDialog({ mode: "edit", row, input: config.toInput(row) });
            }}
          >
            Editar
          </Button>
          <Button variant="destructive" disabled={selected.size === 0} onClick={askDelete}>
            Excluir
          </Button>
          <Button onClick={() => setDialog({ mode: "create" })}>Adicionar</Button>
        </div>
      </div>

      <DataTable columns={config.columns} rows={pageRows} selected={selected} onToggle={toggle} />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {rows.length} registro{rows.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span>
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>

      {dialog && (
        <FormDialog
          config={config}
          dialog={dialog}
          onClose={() => setDialog(null)}
          onSaved={() => void reload()}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        message={confirm?.message ?? ""}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        onConfirm={() => void doDelete()}
      />
    </div>
  );
}
```

- [ ] **Step 2: Escrever FormDialog.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { CrudConfig } from "./CrudPage";
import { msg } from "@/lib/api";

export function FormDialog<T extends { id: number }, F, E>({
  config, dialog, onClose, onSaved,
}: {
  config: CrudConfig<T, F, E>;
  dialog: { mode: "create" } | { mode: "edit"; row: T; input: F };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<F>(() =>
    dialog.mode === "create" ? config.empty() : dialog.input
  );
  const [resources, setResources] = useState<E | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    config.loadResources().then(setResources).catch((e) => setError(msg(e)));
  }, [config]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (dialog.mode === "create") {
        await config.create(value);
        toast.success("Salvo");
        onSaved();
        if (config.keepOpen) {
          setValue(config.empty());
        } else {
          onClose();
        }
      } else {
        await config.update(dialog.row.id, value);
        toast.success("Salvo");
        onSaved();
        onClose();
      }
    } catch (e) {
      setError(msg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialog.mode === "create" ? "Novo" : "Editar"}</DialogTitle>
        </DialogHeader>
        {resources === null ? (
          <p className="py-4 text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <config.FormFields
            value={value}
            onChange={setValue}
            resources={resources}
            error={error}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Verificar tipos**

```bash
bunx tsc --noEmit 2>&1 | head -20
```

Expected: sem erros. Se `sonner` não estiver configurado com `<Toaster />` ainda, apenas avisos de uso.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: CRUD generico com paginacao e modais"
```

### Task 21: layout — sidebar, tema, update check

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/UpdateDialog.tsx`

- [ ] **Step 1: Ler o layout do template e substituir**

Leia `src/app/layout.tsx` (e `src/components/theme-provider.tsx` se existir) para ver a estrutura atual. Substitua o body por sidebar + providers. Mantenha `ThemeProvider` (do template) e o `<Toaster />` (sonner).

```tsx
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { MonthProvider } from "@/lib/month-context";
import { Sidebar } from "@/components/Sidebar";
import { UpdateDialog } from "@/components/UpdateDialog";
import "./globals.css";

export const metadata: Metadata = { title: "Ajuda Finanças" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <MonthProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 p-6">
                <div className="mx-auto max-w-5xl">{children}</div>
              </main>
            </div>
            <Toaster position="top-right" richColors />
            <UpdateDialog />
          </MonthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Escrever Sidebar.tsx**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight, CalendarClock, CreditCard, HandCoins,
  LayoutDashboard, Moon, RefreshCw, Sun, Tags,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MonthPicker } from "@/components/MonthPicker";
import { Button } from "@/components/ui/button";
import { useMonth } from "@/lib/month-context";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/payment-methods", label: "Formas de Pagamento", icon: CreditCard },
  { href: "/categories", label: "Categorias", icon: Tags },
  { href: "/fixed-bills", label: "Contas Fixas", icon: RefreshCw },
  { href: "/installments", label: "Parcelamentos", icon: CalendarClock },
  { href: "/loans", label: "Financiamentos/Empréstimos", icon: HandCoins },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { month, setMonth, min } = useMonth();
  const [version, setVersion] = useState("");

  useEffect(() => {
    api.getVersion().then(setVersion).catch(() => {});
  }, []);

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-2 border-r bg-muted/40 p-4">
      <div className="px-2 pt-1 text-lg font-bold tracking-tight">Ajuda Finanças</div>
      <MonthPicker value={month} onChange={setMonth} min={min} />
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
                active && "bg-accent"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <Button
        variant="ghost"
        className="justify-start"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        Tema
      </Button>
      <p className="text-center text-xs text-muted-foreground">{version}</p>
    </aside>
  );
}
```

- [ ] **Step 3: Escrever UpdateDialog.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { msg } from "@/lib/api";

export function UpdateDialog() {
  const [available, setAvailable] = useState<null | { version: string }>(null);
  const [doing, setDoing] = useState(false);

  useEffect(() => {
    check()
      .then((u) => { if (u?.isAvailable()) setAvailable({ version: u.version }); })
      .catch(() => {});
  }, []);

  const apply = async () => {
    setDoing(true);
    try {
      const update = await check();
      if (update?.isAvailable()) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch (e) {
      setDoing(false);
      toast.error(msg(e));
    }
  };

  return (
    <Dialog open={!!available} onOpenChange={(o) => { if (!o) setAvailable(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova versão disponível</DialogTitle>
          <DialogDescription>
            Versão {available?.version} disponível. Atualizar agora?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAvailable(null)}>Agora não</Button>
          <Button onClick={() => void apply()} disabled={doing}>
            {doing ? "Baixando..." : "Atualizar e reiniciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`@tauri-apps/plugin-process` pode não existir ainda; se `relaunch` der erro de pacote, adicione: `bun add @tauri-apps/plugin-process` e em `src-tauri` rode `bunx tauri add process` (ou adicione `tauri-plugin-process` no Cargo.toml + `bun add @tauri-apps/plugin-process` e registre `.plugin(tauri_plugin_process::init())` no lib.rs).

- [ ] **Step 4: Verificar e commit**

```bash
bunx tsc --noEmit 2>&1 | head -20
git add -A && git commit -m "feat: layout com sidebar, tema e update dialog"
```

### Task 22: dashboard

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Escrever page.tsx**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useMonth } from "@/lib/month-context";
import { api, msg } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { DashboardData } from "@/lib/types";

export default function DashboardPage() {
  const { month } = useMonth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async (withSync: boolean) => {
    try {
      setData(withSync ? await api.syncDashboard(month) : await api.getDashboard(month));
    } catch (e) {
      toast.error(msg(e));
    }
  }, [month]);

  useEffect(() => { void load(false); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Button variant="outline" size="sm" disabled={syncing} onClick={() => { setSyncing(true); void load(true).finally(() => setSyncing(false)); }}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Sincronizar
        </Button>
      </div>

      {!data ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Receitas" value={formatMoney(data.income)} positive />
            <StatCard label="Despesas" value={formatMoney(data.expenses)} negative />
            <StatCard label="Saldo do mês" value={formatMoney(data.income - data.expenses)}
              positive={data.income - data.expenses >= 0} />
            <StatCard label="Saldo acumulado" value={formatMoney(data.balance)}
              positive={data.balance >= 0} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Receitas por categoria</CardTitle></CardHeader>
              <CardContent>
                {data.income_by_cat.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem receitas</p>
                ) : (
                  <ul className="space-y-2">
                    {data.income_by_cat.map((b) => (
                      <li key={b.name} className="flex items-center justify-between text-sm">
                        <span>{b.name}</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{formatMoney(b.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Despesas por forma de pagamento</CardTitle></CardHeader>
              <CardContent>
                {data.expenses_by_pm.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem despesas</p>
                ) : (
                  <ul className="space-y-2">
                    {data.expenses_by_pm.map((b) => (
                      <li key={b.name} className="flex items-center justify-between text-sm">
                        <span>{b.name}</span>
                        <span className="text-rose-600 dark:text-rose-400">{formatMoney(b.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  const cls = positive ? "text-emerald-600 dark:text-emerald-400"
    : negative ? "text-rose-600 dark:text-rose-400" : "";
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle></CardHeader>
      <CardContent><div className={cls + " text-2xl font-bold"}>{value}</div></CardContent>
    </Card>
  );
}
```

Nota: o card de saldo acumulado usa `data.balance`; no spec `balance` = prev_balance + (income - expenses).

- [ ] **Step 2: Verificar e commit**

```bash
bunx tsc --noEmit 2>&1 | head -20
git add -A && git commit -m "feat: dashboard"
```

### Task 23: transações

**Files:**
- Create: `src/app/transactions/page.tsx`, `src/components/forms/TransactionForm.tsx`

- [ ] **Step 1: Escrever TransactionForm.tsx**

```tsx
"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Category, PaymentMethod, TransactionInput } from "@/lib/types";

export function TransactionForm({
  value, onChange, resources, error,
}: {
  value: TransactionInput;
  onChange: (v: TransactionInput) => void;
  resources: { categories: Category[]; paymentMethods: PaymentMethod[] };
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Label>Descrição</Label>
        <Input value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </div>
      <div>
        <Label>Valor (R$)</Label>
        <Input
          type="number" step="0.01" min="0"
          value={value.amount === 0 ? "" : (value.amount / 100).toFixed(2)}
          onChange={(e) => onChange({ ...value, amount: Math.round(Number(e.target.value) * 100) })}
        />
      </div>
      <div>
        <Label>Tipo</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio" name="tx-type" checked={value.type === 1}
              onChange={() => onChange({ ...value, type: 1 })}
            />
            Receita
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio" name="tx-type" checked={value.type === 2}
              onChange={() => onChange({ ...value, type: 2 })}
            />
            Despesa
          </label>
        </div>
      </div>
      <div>
        <Label>Data</Label>
        <Input
          type="date"
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
        />
      </div>
      <div>
        <Label>Categoria</Label>
        <Select
          value={value.category_id?.toString() ?? ""}
          onChange={(v) => onChange({ ...value, category_id: v ? Number(v) : null })}
          options={resources.categories.map((c) => ({ value: c.id.toString(), label: c.name }))}
          placeholder="Sem categoria"
        />
      </div>
      <div>
        <Label>Forma de pagamento</Label>
        <Select
          value={value.payment_method_id?.toString() ?? ""}
          onChange={(v) => onChange({ ...value, payment_method_id: v ? Number(v) : null })}
          options={resources.paymentMethods.map((p) => ({ value: p.id.toString(), label: p.name }))}
          placeholder={value.type === 2 ? "Obrigatória para despesa" : "Opcional"}
        />
      </div>
    </div>
  );
}
```

Crie `src/components/forms/Select.tsx` (select nativo com estilo shadcn — ponytail: evita o Select complexo do shadcn):

```tsx
"use client";
import { cn } from "@/lib/utils";

export function Select({
  value, onChange, options, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <option value="">{placeholder ?? "Selecione"}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Escrever transactions/page.tsx**

```tsx
"use client";
import { useCallback } from "react";
import { CrudPage } from "@/components/crud/CrudPage";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { useMonth } from "@/lib/month-context";
import { api } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { Category, PaymentMethod, TransactionInput, TransactionRow } from "@/lib/types";

export default function TransactionsPage() {
  const { month } = useMonth();
  const load = useCallback(() => api.listTransactions(month), [month]);
  return (
    <CrudPage
      config={{
        title: "Transações",
        columns: [
          { header: "Data", render: (r) => formatDate(r.date) },
          { header: "Descrição", render: (r) => r.description },
          { header: "Categoria", render: (r) => r.category_name ?? "—" },
          { header: "Forma", render: (r) => r.payment_method_name ?? "—" },
          {
            header: "Valor",
            render: (r) => (
              <span className={r.type === 1 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                {r.type === 1 ? "+" : "−"} {formatMoney(r.amount)}
              </span>
            ),
          },
        ],
        keepOpen: true,
        load,
        create: api.createTransaction,
        update: (id, d) => api.updateTransaction(id, d),
        remove: api.deleteTransactions,
        empty: () => ({
          description: "", amount: 0, type: 2, date: new Date().toISOString().slice(0, 10),
          category_id: null, payment_method_id: null,
        }),
        toInput: (r) => ({
          description: r.description, amount: r.amount, type: r.type, date: r.date,
          category_id: r.category_id, payment_method_id: r.payment_method_id,
        }),
        loadResources: async () => {
          const [categories, paymentMethods] = await Promise.all([
            api.listCategories(), api.listPaymentMethods(),
          ]);
          return { categories, paymentMethods };
        },
        FormFields: TransactionForm,
        reloadKey: month,
      }}
    />
  );
}
```

- [ ] **Step 3: Verificar e commit**

```bash
bunx tsc --noEmit 2>&1 | head -20
git add -A && git commit -m "feat: pagina de transacoes"
```

### Task 24: formas de pagamento + categorias

**Files:**
- Create: `src/app/payment-methods/page.tsx`, `src/app/categories/page.tsx`, `src/components/forms/PaymentMethodForm.tsx`, `src/components/forms/CategoryForm.tsx`

- [ ] **Step 1: Escrever PaymentMethodForm.tsx**

```tsx
"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentMethodInput } from "@/lib/types";

export function PaymentMethodForm({
  value, onChange, error,
}: {
  value: PaymentMethodInput;
  onChange: (v: PaymentMethodInput) => void;
  resources: Record<string, never>;
  error: string | null;
}) {
  const isCard = value.type === 2;
  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Label>Nome</Label>
        <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </div>
      <div>
        <Label>Tipo</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={!isCard} onChange={() => onChange({ ...value, type: 1, close_day: null, validity_day: null })} />
            Padrão
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={isCard} onChange={() => onChange({ ...value, type: 2 })} />
            Cartão
          </label>
        </div>
      </div>
      {isCard && (
        <>
          <div>
            <Label>Dia de fechamento</Label>
            <Input type="number" min="1" max="31" value={value.close_day ?? ""}
              onChange={(e) => onChange({ ...value, close_day: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <Label>Dia de vencimento</Label>
            <Input type="number" min="1" max="31" value={value.validity_day ?? ""}
              onChange={(e) => onChange({ ...value, validity_day: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Escrever CategoryForm.tsx**

```tsx
"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CategoryInput } from "@/lib/types";

export function CategoryForm({
  value, onChange, error,
}: {
  value: CategoryInput;
  onChange: (v: CategoryInput) => void;
  resources: Record<string, never>;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Label>Nome</Label>
        <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </div>
      <div>
        <Label>Tipo</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={value.type === 1} onChange={() => onChange({ ...value, type: 1 })} />
            Receita
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={value.type === 2} onChange={() => onChange({ ...value, type: 2 })} />
            Despesa
          </label>
        </div>
      </div>
      <div>
        <Label>Cor</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} className="h-10 w-14 rounded border border-input bg-background" />
          <Input value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Ícone</Label>
        <Input value={value.icon ?? ""} placeholder="ex.: lucide shopping-cart"
          onChange={(e) => onChange({ ...value, icon: e.target.value || null })} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Escrever as páginas**

`src/app/payment-methods/page.tsx`:

```tsx
"use client";
import { CrudPage } from "@/components/crud/CrudPage";
import { PaymentMethodForm } from "@/components/forms/PaymentMethodForm";
import { api } from "@/lib/api";
import type { PaymentMethod, PaymentMethodInput } from "@/lib/types";

export default function PaymentMethodsPage() {
  return (
    <CrudPage
      config={{
        title: "Formas de Pagamento",
        columns: [
          { header: "Nome", render: (r) => r.name },
          { header: "Tipo", render: (r) => (r.type === 2 ? "Cartão" : "Padrão") },
          {
            header: "Fechamento/Vencimento",
            render: (r) => {
              if (r.type !== 2) return "—";
              try {
                const m = r.metadata ? JSON.parse(r.metadata) : null;
                return m?.close_day ? `${m.close_day}/${m.validity_day ?? "?"}` : "—";
              } catch { return "—"; }
            },
          },
        ],
        load: api.listPaymentMethods,
        create: api.createPaymentMethod,
        update: (id, d) => api.updatePaymentMethod(id, d),
        remove: api.deletePaymentMethods,
        empty: () => ({ name: "", type: 1, close_day: null, validity_day: null }),
        toInput: (r) => {
          const m = r.metadata ? JSON.parse(r.metadata) : null;
          return {
            name: r.name, type: r.type,
            close_day: r.type === 2 ? (m?.close_day ?? null) : null,
            validity_day: r.type === 2 ? (m?.validity_day ?? null) : null,
          };
        },
        loadResources: async () => ({}),
        FormFields: PaymentMethodForm,
      }}
    />
  );
}
```

`src/app/categories/page.tsx`:

```tsx
"use client";
import { CrudPage } from "@/components/crud/CrudPage";
import { CategoryForm } from "@/components/forms/CategoryForm";
import { api } from "@/lib/api";
import type { Category, CategoryInput } from "@/lib/types";

export default function CategoriesPage() {
  return (
    <CrudPage
      config={{
        title: "Categorias",
        columns: [
          {
            header: "Cor",
            render: (r) => <span className="inline-block h-4 w-4 rounded-full border" style={{ backgroundColor: r.color }} />,
          },
          { header: "Nome", render: (r) => r.name },
          { header: "Tipo", render: (r) => (r.type === 1 ? "Receita" : "Despesa") },
        ],
        load: api.listCategories,
        create: api.createCategory,
        update: (id, d) => api.updateCategory(id, d),
        remove: api.deleteCategories,
        empty: () => ({ name: "", type: 2, color: "#6b7280", icon: null }),
        toInput: (r) => ({ name: r.name, type: r.type, color: r.color, icon: r.icon }),
        loadResources: async () => ({}),
        FormFields: CategoryForm,
      }}
    />
  );
}
```

- [ ] **Step 4: Verificar e commit**

```bash
bunx tsc --noEmit 2>&1 | head -20
git add -A && git commit -m "feat: paginas de formas de pagamento e categorias"
```

### Task 25: contas fixas + parcelamentos

**Files:**
- Create: `src/app/fixed-bills/page.tsx`, `src/app/installments/page.tsx`, `src/components/forms/FixedBillForm.tsx`

- [ ] **Step 1: Escrever FixedBillForm.tsx** (modo recurring ou installments)

```tsx
"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/forms/Select";
import { MonthPicker } from "@/components/MonthPicker";
import type { Category, FixedBillInput, PaymentMethod } from "@/lib/types";

export interface FixedBillResources {
  categories: Category[];
  paymentMethods: PaymentMethod[];
  cardCloseDays: Record<number, number>;
}

export function FixedBillForm({
  value, onChange, resources, error, mode,
}: {
  value: FixedBillInput;
  onChange: (v: FixedBillInput) => void;
  resources: FixedBillResources;
  error: string | null;
  mode: "recurring" | "installments";
}) {
  const cardDay = value.payment_method_id
    ? resources.cardCloseDays[value.payment_method_id]
    : undefined;
  const effectiveDay = cardDay ?? value.day;
  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Label>Descrição</Label>
        <Input value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" min="0"
            value={value.amount === 0 ? "" : (value.amount / 100).toFixed(2)}
            onChange={(e) => onChange({ ...value, amount: Math.round(Number(e.target.value) * 100) })} />
        </div>
        <div>
          <Label>Dia</Label>
          <Input type="number" min="1" max="31" value={value.day || ""}
            onChange={(e) => onChange({ ...value, day: Number(e.target.value) })} />
          {cardDay ? (
            <p className="mt-1 text-xs text-muted-foreground">Cartão: dia de fechamento {cardDay}</p>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Categoria</Label>
          <Select
            value={value.category_id?.toString() ?? ""}
            onChange={(v) => onChange({ ...value, category_id: v ? Number(v) : null })}
            options={resources.categories.map((c) => ({ value: c.id.toString(), label: c.name }))}
            placeholder="Sem categoria"
          />
        </div>
        <div>
          <Label>Forma de pagamento</Label>
          <Select
            value={value.payment_method_id.toString()}
            onChange={(v) => onChange({ ...value, payment_method_id: Number(v) })}
            options={resources.paymentMethods.map((p) => ({ value: p.id.toString(), label: p.name }))}
          />
        </div>
      </div>
      <div>
        <Label>Mês de início</Label>
        <MonthPicker value={value.start_month} onChange={(m) => onChange({ ...value, start_month: m })} />
      </div>
      {mode === "installments" ? (
        <div>
          <Label>Quantidade de parcelas</Label>
          <Input type="number" min="2" value={value.installments ?? ""}
            onChange={(e) => onChange({ ...value, installments: e.target.value ? Number(e.target.value) : null })} />
        </div>
      ) : (
        <div>
          <Label>Duração</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={!value.end_month} onChange={() => onChange({ ...value, end_month: null })} />
              Indefinida
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={!!value.end_month} onChange={() => onChange({ ...value, end_month: value.start_month })} />
              Até uma data
            </label>
          </div>
          {value.end_month && (
            <div className="mt-2">
              <Label>Mês de fim</Label>
              <MonthPicker value={value.end_month} onChange={(m) => onChange({ ...value, end_month: m })} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Escrever as páginas**

`src/app/fixed-bills/page.tsx`:

```tsx
"use client";
import { CrudPage } from "@/components/crud/CrudPage";
import { FixedBillForm } from "@/components/forms/FixedBillForm";
import { api } from "@/lib/api";
import { formatMonth, formatMoney } from "@/lib/format";
import type { FixedBill, FixedBillInput } from "@/lib/types";

export default function FixedBillsPage() {
  return (
    <CrudPage
      config={{
        title: "Contas Fixas",
        columns: [
          { header: "Descrição", render: (r) => r.description },
          { header: "Valor", render: (r) => formatMoney(r.amount) },
          { header: "Dia", render: (r) => r.day },
          { header: "Início", render: (r) => formatMonth(r.start_month) },
          { header: "Fim", render: (r) => (r.end_month ? formatMonth(r.end_month) : "—") },
        ],
        load: () => api.listFixedBills(false),
        create: api.createFixedBill,
        update: (id, d) => api.updateFixedBill(id, d),
        remove: api.deleteFixedBills,
        empty: () => ({
          description: "", amount: 0, day: 1, category_id: null,
          payment_method_id: 0, start_month: new Date().toISOString().slice(0, 7),
          end_month: null, installments: null,
        }),
        toInput: (r) => ({
          description: r.description, amount: r.amount, day: r.day,
          category_id: r.category_id, payment_method_id: r.payment_method_id,
          start_month: r.start_month, end_month: r.end_month, installments: r.installments,
        }),
        loadResources: async () => {
          const [categories, paymentMethods] = await Promise.all([
            api.listCategories(), api.listPaymentMethods(),
          ]);
          const cardCloseDays: Record<number, number> = {};
          for (const pm of paymentMethods) {
            if (pm.type === 2 && pm.metadata) {
              try {
                const m = JSON.parse(pm.metadata);
                if (m.close_day) cardCloseDays[pm.id] = m.close_day;
              } catch { /* ignore */ }
            }
          }
          return { categories, paymentMethods, cardCloseDays };
        },
        FormFields: (props) => <FixedBillForm {...props} mode="recurring" />,
      }}
    />
  );
}
```

`src/app/installments/page.tsx`: idêntico, mas:
- `title: "Parcelamentos"`
- `load: () => api.listFixedBills(true)`
- `FormFields: (props) => <FixedBillForm {...props} mode="installments" />`
- coluna extra: `{ header: "Parcelas", render: (r) => r.installments ?? "—" }`

- [ ] **Step 3: Verificar e commit**

```bash
bunx tsc --noEmit 2>&1 | head -20
git add -A && git commit -m "feat: paginas de contas fixas e parcelamentos"
```

### Task 26: empréstimos + detalhe

**Files:**
- Create: `src/app/loans/page.tsx`, `src/components/forms/LoanForm.tsx`, `src/components/loans/DetailDialog.tsx`

- [ ] **Step 1: Escrever LoanForm.tsx**

```tsx
"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/forms/Select";
import { MonthPicker } from "@/components/MonthPicker";
import type { LoanInput, PaymentMethod } from "@/lib/types";

export function LoanForm({
  value, onChange, resources, error,
}: {
  value: LoanInput;
  onChange: (v: LoanInput) => void;
  resources: { paymentMethods: PaymentMethod[] };
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Label>Tipo</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={value.type === 1} onChange={() => onChange({ ...value, type: 1 })} />
            Empréstimo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={value.type === 2} onChange={() => onChange({ ...value, type: 2 })} />
            Financiamento
          </label>
        </div>
      </div>
      <div>
        <Label>Descrição</Label>
        <Input value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" min="0"
            value={value.principal === 0 ? "" : (value.principal / 100).toFixed(2)}
            onChange={(e) => onChange({ ...value, principal: Math.round(Number(e.target.value) * 100) })} />
        </div>
        <div>
          <Label>Valor da parcela (R$)</Label>
          <Input type="number" step="0.01" min="0"
            value={value.installment === 0 ? "" : (value.installment / 100).toFixed(2)}
            onChange={(e) => onChange({ ...value, installment: Math.round(Number(e.target.value) * 100) })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Número de parcelas</Label>
          <Input type="number" min="2" value={value.total_installments || ""}
            onChange={(e) => onChange({ ...value, total_installments: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Dia</Label>
          <Input type="number" min="1" max="31" value={value.day || ""}
            onChange={(e) => onChange({ ...value, day: Number(e.target.value) })} />
        </div>
      </div>
      <div>
        <Label>Mês de início</Label>
        <MonthPicker value={value.start_month} onChange={(m) => onChange({ ...value, start_month: m })} />
      </div>
      <div>
        <Label>Forma de pagamento</Label>
        <Select
          value={value.payment_method_id.toString()}
          onChange={(v) => onChange({ ...value, payment_method_id: Number(v) })}
          options={resources.paymentMethods.map((p) => ({ value: p.id.toString(), label: p.name }))}
        />
      </div>
      {value.total_installments >= 2 && value.installment * value.total_installments < value.principal && (
        <p className="text-sm text-destructive">Total das parcelas menor que o valor</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Escrever DetailDialog.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api, msg } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { LoanDetail } from "@/lib/types";

export function DetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const [detail, setDetail] = useState<LoanDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    setDetail(null);
    api.getLoanDetail(id).then(setDetail).catch((e) => msg(e));
  }, [id]);

  const totalPaid = detail?.schedule.reduce((s, r) => s + r.installment, 0) ?? 0;

  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {detail?.loan.description ?? "Carregando..."}
          </DialogTitle>
        </DialogHeader>
        {detail && (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-4">
              <span>Valor: <b>{formatMoney(detail.loan.principal)}</b></span>
              <span>Parcela: <b>{formatMoney(detail.loan.installment)}</b></span>
              <span>Total: <b>{formatMoney(totalPaid)}</b></span>
              <span>Juros: <b>{formatMoney(totalPaid - detail.loan.principal)}</b></span>
              <span>Parcelas: <b>{detail.loan.paid_count}/{detail.loan.total_installments}</b></span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Parcela</TableHead>
                  <TableHead className="text-right">Juros</TableHead>
                  <TableHead className="text-right">Amortização</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.schedule.map((r) => (
                  <TableRow key={r.number}>
                    <TableCell>{r.number}</TableCell>
                    <TableCell>{r.month}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.installment)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.interest)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.principal)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Escrever loans/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CrudPage } from "@/components/crud/CrudPage";
import { LoanForm } from "@/components/forms/LoanForm";
import { DetailDialog } from "@/components/loans/DetailDialog";
import { api } from "@/lib/api";
import { formatMonth, formatMoney } from "@/lib/format";
import type { Loan, LoanInput } from "@/lib/types";

export default function LoansPage() {
  const [detailId, setDetailId] = useState<number | null>(null);
  return (
    <>
      <CrudPage
        config={{
          title: "Financiamentos/Empréstimos",
          columns: [
            { header: "Descrição", render: (r) => r.description },
            { header: "Tipo", render: (r) => (r.type === 1 ? "Empréstimo" : "Financiamento") },
            { header: "Valor", render: (r) => formatMoney(r.principal) },
            { header: "Parcela", render: (r) => formatMoney(r.installment) },
            { header: "Parcelas", render: (r) => `${r.paid_count}/${r.total_installments}` },
            { header: "Início", render: (r) => formatMonth(r.start_month) },
            { header: "Fim", render: (r) => formatMonth(r.end_month) },
          ],
          load: api.listLoans,
          create: api.createLoan,
          update: (id, d) => api.updateLoan(id, d),
          remove: api.deleteLoans,
          empty: () => ({
            type: 1, description: "", principal: 0, installment: 0,
            total_installments: 0, day: 1,
            start_month: new Date().toISOString().slice(0, 7),
            payment_method_id: 0,
          }),
          toInput: (r: Loan) => ({
            type: r.type, description: r.description, principal: r.principal,
            installment: r.installment, total_installments: r.total_installments,
            day: r.day, start_month: r.start_month, payment_method_id: r.payment_method_id,
          }),
          loadResources: async () => ({ paymentMethods: await api.listPaymentMethods() }),
          FormFields: LoanForm,
        }}
      />
      <div className="mt-2">
        <Button variant="outline" onClick={() => setDetailId(1)} disabled>
          Visualizar (selecione)
        </Button>
      </div>
      <DetailDialog id={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}
```

Nota: o botão "Visualizar" do CrudPage genérico não suporta view. Para atender ao spec (empréstimos têm detail), a abordagem simples: cada linha abre o detail via duplo clique. Ajuste `CrudPage` para aceitar `onRowDoubleClick?: (row: T) => void` (adicione `onDoubleClick` no `TableRow` do `DataTable`). Faça essa extensão:

- `src/components/crud/types.ts`: nada a mudar (Column).
- `DataTable.tsx`: prop `onRowDoubleClick?: (row: T) => void`, e `onDoubleClick={() => onRowDoubleClick?.(row)}` no `TableRow`.
- `CrudPage.tsx`: prop `onRowDoubleClick?: (row: T) => void`, repassada ao DataTable.
- `loans/page.tsx`: `onRowDoubleClick={(r) => setDetailId(r.id)}` no config e remova o botão placeholder.

- [ ] **Step 4: Verificar e commit**

```bash
bunx tsc --noEmit 2>&1 | head -20
git add -A && git commit -m "feat: pagina de emprestimos com detalhe"
```

### Task 27: integração de build do Tauri

- [ ] **Step 1: build completo**

```bash
cd /home/daniel/Projects/AjudaFinancasTauri
bun run tauri build 2>&1 | tail -30
```

Expected: gera bundle (AppImage/deb) em `src-tauri/target/release/bundle/`. Primeira compilação é lenta.

- [ ] **Step 2: rodar o app (dev)**

```bash
bun run tauri dev 2>&1 | tail -20
```

Expected: abre janela "Ajuda Finanças" com dashboard. Teste manual: dashboard, transação (CRUD), conta fixa (verificar geração de transação no dashboard), empréstimo (verificar tabela de amortização), tema, filtro de mês.

- [ ] **Step 3: corrigir o que quebrar** e repetir Step 1/2 até o app funcionar.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: build integrado do tauri"
```

---

## Fase 3 — Distribuição

### Task 28: testes de backend finais e documentação

- [ ] **Step 1: Rodar toda a suíte**

```bash
cd src-tauri && cargo test 2>&1 | tail -6
cd /home/daniel/Projects/AjudaFinancasTauri && bunx tsc --noEmit 2>&1 | head -10
```

Expected: todos os testes `ok`; tsc sem erros.

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "chore: verificacao final de testes"
```

### Task 29: updater — chaves, endpoints, workflow

- [ ] **Step 1: Gerar par de chaves**

```bash
cd /home/daniel/Projects/AjudaFinancasTauri
bunx tauri signer generate -w ~/.tauri/ajudafinancas.key
```

Expected: cria chave privada + imprime a **pubkey**. Copie a pubkey para `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.

- [ ] **Step 2: Configurar endpoint**

Edite `src-tauri/tauri.conf.json` `plugins.updater.endpoints[0]` com o repo GitHub real (usuário + nome do repo). A `latest.json` é gerada pelo workflow de release.

- [ ] **Step 3: Workflow de release**

O template já inclui `.github/workflows/release.yml`. Ajuste para publicar o artefato do updater (o `tauri-action` gera `latest.json` quando `createUpdaterArtifacts: true`). Verifique o workflow e confirme que o release é disparado por tag `v*` e faz upload dos assets. Se o workflow não usar `tauri-apps/tauri-action`, troque o passo de build para:

```yaml
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: "v__VERSION__"
          releaseBody: "Veja os assets abaixo"
          releaseDraft: true
          prerelease: false
```

Adicione no repo os secrets `TAURI_SIGNING_PRIVATE_KEY` (conteúdo do arquivo `.key` gerado) e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (senha definida na geração).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: configuracao do updater"
```

### Task 30: README

- [ ] **Step 1: Escrever README.md**

Resuma: requisitos (rustup, bun, libs de sistema), `bun install`, `bun run tauri dev`, `bun run tauri build`, e como criar release (tag `v*`, secrets de assinatura).

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "docs: readme"
```

---

## Notas de risco

- **Versões de crate**: `cargo add` resolve versões; se `rusqlite_migration` pedir versão incompatível de `rusqlite`, use `cargo add rusqlite@0.31` + `cargo add rusqlite_migration` (1.0.x) — o erro de compilação indica a versão correta.
- **`@tauri-apps/plugin-process`**: o `relaunch()` no UpdateDialog requer o plugin; se não vier no template, `bunx tauri add process`.
- **Estrutura do template**: se o scaffold Next gerar caminhos diferentes (ex. `src/app` ausente, layout em outro lugar), ajuste os caminhos das tasks 21–26 para a estrutura real.
- **Teste de tela**: `tauri dev` precisa de display (Linux desktop). Em headless, pule a verificação visual e confie em `cargo test` + `tsc` + `bun run build`.
