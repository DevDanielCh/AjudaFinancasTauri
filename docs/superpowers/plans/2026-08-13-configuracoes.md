# Tela de Configurações (primeiro mês + saldos iniciais) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela de configurações que define o primeiro mês de uso (piso rígido das análises) e os saldos iniciais da conta e da reserva.

**Architecture:** Tabela key-value `settings` (migração 008). Backend: `domain::get_settings`/`set_settings` + `commands/settings.rs`; agregações (`account_balance_at`, `reserva_balance_at`, `monthly_series`, dashboard) passam a respeitar o piso e semear os saldos quando configurados, mantendo o comportamento atual sem configuração. Frontend: query react-query `settings`/`earliest-month`, página `/configuracoes`, resumo da reserva soma o saldo inicial.

**Tech Stack:** Rust (rusqlite, tauri), Next.js 16, TanStack Query, zod, daisyUI/shadcn.

**Verificação:** `rtk cargo test --manifest-path src-tauri/Cargo.toml`, `bun run typecheck`, `bun run lint`.

---

### Task 1: Migração 008 + models Settings

**Files:**
- Create: `src-tauri/migrations/008_settings.sql`
- Modify: `src-tauri/src/db.rs:10-20`
- Modify: `src-tauri/src/models.rs` (fim do arquivo)

- [ ] **Step 1: Criar a migração**

Crie `src-tauri/migrations/008_settings.sql`:

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

- [ ] **Step 2: Registrar a migração em `db.rs`**

Em `src-tauri/src/db.rs`, no vetor de `migrations()`, após a 007:

```rust
M::up(include_str!("../migrations/008_settings.sql")),
```

- [ ] **Step 3: Adicionar `Settings`/`SettingsInput` em `models.rs`**

Adicione ao final de `src-tauri/src/models.rs`:

```rust
// ---- Configurações ----

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    #[serde(default)]
    pub primeiro_mes: Option<String>,
    #[serde(default)]
    pub saldo_inicial_conta: i64,
    #[serde(default)]
    pub saldo_inicial_reserva: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsInput {
    #[serde(default)]
    pub primeiro_mes: Option<String>,
    #[serde(default)]
    pub saldo_inicial_conta: i64,
    #[serde(default)]
    pub saldo_inicial_reserva: i64,
}

impl SettingsInput {
    pub fn validate(&self) -> Result<(), String> {
        if let Some(pm) = &self.primeiro_mes {
            let d = month_str_to_date(pm)?;
            if d > chrono::Local::now().date_naive().with_day(1).unwrap() {
                return Err("primeiro mês não pode ser no futuro".into());
            }
        }
        if self.saldo_inicial_conta < 0 || self.saldo_inicial_reserva < 0 {
            return Err("saldos não podem ser negativos".into());
        }
        Ok(())
    }
}
```

- [ ] **Step 4: Compilar**

Run: `rtk cargo build --manifest-path src-tauri/Cargo.toml`
Expected: compila sem erro.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/migrations/008_settings.sql src-tauri/src/db.rs src-tauri/src/models.rs
git commit -m "feat: tabela settings e models de configuracoes"
```

---

### Task 2: `get_settings`/`set_settings` em domain.rs

**Files:**
- Modify: `src-tauri/src/domain.rs` (perto de `earliest_month`, linha ~71)

- [ ] **Step 1: Escrever helpers de settings**

Em `src-tauri/src/domain.rs`, após a função `current_month()` (linha ~69):

```rust
/// Lê as configurações; ausência = defaults (None, 0, 0).
pub fn get_settings(conn: &Connection) -> Result<crate::models::Settings, String> {
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(db_err)?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    let mut s = crate::models::Settings::default();
    for (k, v) in rows {
        match k.as_str() {
            "primeiro_mes" => s.primeiro_mes = Some(v),
            "saldo_inicial_conta" => s.saldo_inicial_conta = v.parse().unwrap_or(0),
            "saldo_inicial_reserva" => s.saldo_inicial_reserva = v.parse().unwrap_or(0),
            _ => {}
        }
    }
    Ok(s)
}

/// Persiste as configurações (primeiro_mes None remove a chave).
pub fn set_settings(conn: &Connection, input: &crate::models::SettingsInput) -> Result<(), String> {
    conn.execute("DELETE FROM settings WHERE key = 'primeiro_mes'", [])
        .map_err(db_err)?;
    if let Some(pm) = &input.primeiro_mes {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('primeiro_mes', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [pm],
        )
        .map_err(db_err)?;
    }
    for (key, v) in [
        ("saldo_inicial_conta", input.saldo_inicial_conta.to_string()),
        ("saldo_inicial_reserva", input.saldo_inicial_reserva.to_string()),
    ] {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params![key, v],
        )
        .map_err(db_err)?;
    }
    Ok(())
}
```

- [ ] **Step 2: Compilar**

Run: `rtk cargo build --manifest-path src-tauri/Cargo.toml`
Expected: compila sem erro.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/domain.rs
git commit -m "feat: helpers get/set settings no domain"
```

---

### Task 3: Piso rígido em `earliest_month`

**Files:**
- Modify: `src-tauri/src/domain.rs:71-80`

- [ ] **Step 1: Reescrever `earliest_month`**

Substitua o corpo atual de `earliest_month`:

```rust
/// Mês (YYYY-MM) da transação mais antiga, ou mês corrente.
pub fn earliest_month(conn: &Connection) -> Result<String, String> {
    let s = get_settings(conn)?;
    Ok(s.primeiro_mes.unwrap_or(earliest_tx_month(conn)?))
}

/// Mês da transação mais antiga sem considerar configurações.
fn earliest_tx_month(conn: &Connection) -> Result<String, String> {
    let min = conn.query_row("SELECT MIN(date) FROM transactions", [], |r| {
        r.get::<_, Option<String>>(0)
    });
    match min {
        Ok(Some(d)) if d.len() >= 7 => Ok(d[..7].to_string()),
        _ => Ok(current_month()),
    }
}
```

- [ ] **Step 2: Compilar e testar**

Run: `rtk cargo test --manifest-path src-tauri/Cargo.toml`
Expected: compila; testes existentes passam.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/domain.rs
git commit -m "feat: earliest_month respeita primeiro mes configurado"
```

---

### Task 4: `reserva_balance_at` com saldo inicial + piso

**Files:**
- Modify: `src-tauri/src/domain.rs:444-454`
- Modify: `src-tauri/src/domain.rs:849-858` (`test_db()` do módulo de testes)

- [ ] **Step 1: Reescrever `reserva_balance_at`**

```rust
pub fn reserva_balance_at(conn: &Connection, before: NaiveDate) -> Result<i64, String> {
    let s = get_settings(conn)?;
    let piso = match &s.primeiro_mes {
        Some(m) => parse_month(m)?.format("%Y-%m-%d").to_string(),
        None => "0000-01-01".to_string(),
    };
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(CASE WHEN type = 4 THEN amount WHEN type = 5 THEN -amount ELSE 0 END), 0)
             FROM transactions WHERE date >= ?1 AND date < ?2",
            rusqlite::params![piso, before.format("%Y-%m-%d").to_string()],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(s.saldo_inicial_reserva + v)
}
```

- [ ] **Step 2: Adicionar a tabela `settings` ao `test_db()` dos testes do domain**

O `test_db()` do módulo `tests` (linha ~849) usa só as migrações 001/002/006.
Sem a 008, `get_settings` (SELECT na tabela `settings`) quebra os testes existentes
de `reserva_balance_at`/`monthly_series`/`refresh_card_bills`/`reconcile_fixed_bills`:

```rust
    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../migrations/001_init.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../migrations/002_card_bills.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../migrations/006_card_debit.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../migrations/008_settings.sql"))
            .unwrap();
        conn
    }
```

- [ ] **Step 3: Compilar e rodar testes existentes**

Run: `rtk cargo test --manifest-path src-tauri/Cargo.toml`
Expected: os testes de `reserva_balance_at`/`monthly_series` existentes passam (sem settings, piso = 0000-01-01 e saldo inicial 0 → mesmo comportamento).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/domain.rs
git commit -m "feat: reserva_balance_at soma saldo inicial e respeita piso"
```

---

### Task 5: `account_balance_at` + série/dashboard com piso

**Files:**
- Modify: `src-tauri/src/domain.rs:456-480` (`monthly_series`)
- Modify: `src-tauri/src/commands/dashboard.rs:29-34`

- [ ] **Step 1: Adicionar `account_balance_at` em domain.rs**

Inserir logo antes de `monthly_series` (linha ~457):

```rust
/// Posição da conta em `before`: saldo inicial + fluxos (receitas - despesas)
/// dos meses desde o piso (ou a primeira transação) até `before`.
pub fn account_balance_at(conn: &Connection, before: NaiveDate) -> Result<i64, String> {
    let s = get_settings(conn)?;
    let start = match &s.primeiro_mes {
        Some(pm) => parse_month(pm)?,
        None => parse_month(&earliest_tx_month(conn)?)?,
    };
    let mut bal = s.saldo_inicial_conta;
    let mut m = start;
    while m < before {
        let next = m.checked_add_months(Months::new(1)).unwrap();
        bal += month_income(conn, m, next)? - month_expenses(conn, m)?;
        m = next;
    }
    Ok(bal)
}
```

- [ ] **Step 2: Reescrever `monthly_series`**

```rust
/// Série terminando em `ref_month`. Com `primeiro_mes` configurado, a série vai
/// do piso até o mês; sem config, janela de `months` meses (comportamento atual).
pub fn monthly_series(
    conn: &Connection,
    ref_month: NaiveDate,
    months: u32,
) -> Result<Vec<crate::models::MonthlyPoint>, String> {
    let s = get_settings(conn)?;
    let with_piso = s.primeiro_mes.is_some();
    let start = match &s.primeiro_mes {
        Some(pm) => parse_month(pm)?,
        None => ref_month.checked_sub_months(Months::new(months - 1)).unwrap(),
    };
    if start > ref_month {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    let mut acc = 0;
    let mut m = start;
    while m <= ref_month {
        let next = m.checked_add_months(Months::new(1)).unwrap();
        let income = month_income(conn, m, next)?;
        let expenses = month_expenses(conn, m)?;
        acc += income - expenses;
        out.push(crate::models::MonthlyPoint {
            month: m.format("%Y-%m").to_string(),
            income,
            expenses,
            balance: if with_piso {
                account_balance_at(conn, next)?
            } else {
                acc
            },
            reserva: reserva_balance_at(conn, next)?,
        });
        m = next;
    }
    Ok(out)
}
```

- [ ] **Step 3: Dashboard usa posição quando há piso**

Em `src-tauri/src/commands/dashboard.rs`, substitua o cálculo de `balance`/`prev_balance` (linhas 29-34):

```rust
    let next = ref_month.checked_add_months(Months::new(1)).unwrap();
    let settings = domain::get_settings(conn)?;
    let (balance, prev_balance) = if settings.primeiro_mes.is_some() {
        (
            domain::account_balance_at(conn, next)?,
            domain::account_balance_at(conn, ref_month)?,
        )
    } else {
        (
            (prev_income - prev_expenses) + (income - expenses),
            prev_income - prev_expenses,
        )
    };

    Ok(DashboardData {
        month: month.to_string(),
        income,
        expenses,
        balance,
        prev_balance,
        income_by_cat,
        expenses_by_pm,
    })
```

Remova a linha 33-34 antiga (`balance:` e `prev_balance:` no struct) ao adicionar o bloco acima. `chrono::Months` já está importado.

- [ ] **Step 4: Compilar e testar**

Run: `rtk cargo test --manifest-path src-tauri/Cargo.toml`
Expected: compila; testes existentes passam (sem settings, comportamento idêntico).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/domain.rs src-tauri/src/commands/dashboard.rs
git commit -m "feat: account_balance_at e series/dashboard respeitam piso e saldo inicial"
```

---

### Task 6: `list_reserva_movements` com piso

**Files:**
- Modify: `src-tauri/src/commands/transactions.rs:81-120`

- [ ] **Step 1: Filtrar por piso**

Em `list_reserva_movements`, troque o SELECT para usar parâmetro de data:

```rust
pub async fn list_reserva_movements(state: State<'_, AppState>) -> Result<Vec<TransactionRow>, String> {
    with_db(&state, |c| {
        let s = domain::get_settings(c)?;
        let piso = s
            .primeiro_mes
            .as_deref()
            .map(|m| format!("{m}-01"))
            .unwrap_or_else(|| "0000-01-01".to_string());
        let mut stmt = c
            .prepare(
                "SELECT t.id, t.description, t.amount, t.type, t.date,
                        t.category_id, c.name, t.payment_method_id, pm.name,
                        t.fixed_bill_id, t.loan_id, (t.bill_start IS NOT NULL), t.card_mode
                 FROM transactions t
                 LEFT JOIN categories c ON c.id = t.category_id
                 LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
                 WHERE t.type IN (4, 5) AND t.date >= ?1
                 ORDER BY t.date DESC, t.id DESC",
            )
            .map_err(domain::db_err)?;
        let rows = stmt
            .query_map(rusqlite::params![piso], |r| {
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
                    is_card_bill: r.get(11)?,
                    card_mode: r.get(12)?,
                    installment: None,
                })
            })
            .map_err(domain::db_err)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(domain::db_err)?;
        Ok(rows)
    })
}
```

- [ ] **Step 2: Compilar**

Run: `rtk cargo build --manifest-path src-tauri/Cargo.toml`
Expected: compila sem erro.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/transactions.rs
git commit -m "feat: list_reserva_movements respeita o primeiro mes"
```

---

### Task 7: Comandos get/update settings + registro

**Files:**
- Create: `src-tauri/src/commands/settings.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs:63-92`

- [ ] **Step 1: Criar o módulo de comandos**

Crie `src-tauri/src/commands/settings.rs`:

```rust
use crate::db::{with_db, AppState};
use crate::domain;
use crate::models::{Settings, SettingsInput};
use tauri::State;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    with_db(&state, domain::get_settings)
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    input: SettingsInput,
) -> Result<(), String> {
    input.validate()?;
    with_db(&state, |c| domain::set_settings(c, &input))
}
```

- [ ] **Step 2: Registrar o módulo**

Em `src-tauri/src/commands/mod.rs`, adicione a linha (ordem alfabética, após `payment_methods`):

```rust
pub mod settings;
```

- [ ] **Step 3: Registrar os comandos em `lib.rs`**

Em `src-tauri/src/lib.rs`, dentro de `generate_handler!` (após a linha do `meta`):

```rust
            commands::settings::get_settings,
            commands::settings::update_settings,
```

- [ ] **Step 4: Compilar**

Run: `rtk cargo build --manifest-path src-tauri/Cargo.toml`
Expected: compila sem erro.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/settings.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: comandos get/update settings"
```

---

### Task 8: Testes de integração backend

**Files:**
- Create: `src-tauri/tests/settings_test.rs`

- [ ] **Step 1: Criar o arquivo de teste**

Crie `src-tauri/tests/settings_test.rs`:

```rust
use ajudafinancas_lib::domain;
use ajudafinancas_lib::models::SettingsInput;
use chrono::NaiveDate;
use rusqlite::Connection;

fn test_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    ajudafinancas_lib::db::migrations().to_latest(&mut conn).unwrap();
    conn
}

fn set(conn: &Connection, primeiro_mes: Option<&str>, conta: i64, reserva: i64) {
    domain::set_settings(
        conn,
        &SettingsInput {
            primeiro_mes: primeiro_mes.map(String::from),
            saldo_inicial_conta: conta,
            saldo_inicial_reserva: reserva,
        },
    )
    .unwrap();
}

#[test]
fn get_settings_default_quando_vazio() {
    let conn = test_db();
    let s = domain::get_settings(&conn).unwrap();
    assert_eq!(s.primeiro_mes, None);
    assert_eq!(s.saldo_inicial_conta, 0);
    assert_eq!(s.saldo_inicial_reserva, 0);
}

#[test]
fn earliest_month_respeita_primeiro_mes() {
    let conn = test_db();
    conn.execute("INSERT INTO transactions (description, amount, type, date) VALUES ('x', 1, 2, '2025-01-10')", [])
        .unwrap();
    assert_eq!(domain::earliest_month(&conn).unwrap(), "2025-01");
    set(&conn, Some("2026-03"), 0, 0);
    assert_eq!(domain::earliest_month(&conn).unwrap(), "2026-03", "config sobrescreve transação antiga");
}

#[test]
fn reserva_balance_soma_saldo_inicial_e_ignora_antes_do_piso() {
    let conn = test_db();
    conn.execute_batch(
        "INSERT INTO transactions (description, amount, type, date) VALUES
         ('antigo', 50000, 4, '2026-01-05'),
         ('aporte', 100000, 4, '2026-06-10'),
         ('resgate', 30000, 5, '2026-06-15')",
    )
    .unwrap();
    set(&conn, Some("2026-06"), 0, 20000);
    let jul = NaiveDate::from_ymd_opt(2026, 7, 1).unwrap();
    assert_eq!(
        domain::reserva_balance_at(&conn, jul).unwrap(),
        90000,
        "saldo inicial 20000 + aporte 100000 - resgate 30000; aporte antigo ignorado"
    );
}

#[test]
fn account_balance_at_soma_fluxos_do_piso() {
    let conn = test_db();
    conn.execute_batch(
        "INSERT INTO transactions (description, amount, type, date) VALUES
         ('receita', 5000, 1, '2026-01-10'),
         ('despesa', 2000, 2, '2026-02-10'),
         ('aporte', 1000, 4, '2026-02-15')",
    )
    .unwrap();
    set(&conn, Some("2026-02"), 10000, 0);
    let mar = NaiveDate::from_ymd_opt(2026, 3, 1).unwrap();
    assert_eq!(
        domain::account_balance_at(&conn, mar).unwrap(),
        7000,
        "saldo 10000 + (0 - despesa 2000 - aporte 1000); receita de janeiro ignorada"
    );
}

#[test]
fn monthly_series_inicia_no_primeiro_mes_e_usa_posicao() {
    let conn = test_db();
    conn.execute(
        "INSERT INTO transactions (description, amount, type, date) VALUES ('aporte', 50000, 4, '2026-06-10')",
        [],
    )
    .unwrap();
    set(&conn, Some("2026-06"), 0, 10000);
    let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
    let pts = domain::monthly_series(&conn, jun, 12).unwrap();
    assert_eq!(pts.len(), 1, "série começa no piso, ignora months");
    assert_eq!(pts[0].month, "2026-06");
    assert_eq!(pts[0].reserva, 60000, "saldo inicial reserva 10000 + aporte 50000");
}

#[test]
fn monthly_series_sem_config_mantem_janela() {
    let conn = test_db();
    let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
    let pts = domain::monthly_series(&conn, jun, 3).unwrap();
    assert_eq!(pts.len(), 3);
    assert_eq!(pts[0].month, "2026-04");
    assert_eq!(pts[2].month, "2026-06");
}

#[test]
fn update_settings_valida() {
    assert!(SettingsInput {
        primeiro_mes: Some("garbage".into()),
        saldo_inicial_conta: 0,
        saldo_inicial_reserva: 0,
    }
    .validate()
    .is_err());
    assert!(SettingsInput {
        primeiro_mes: Some("2099-01".into()),
        saldo_inicial_conta: 0,
        saldo_inicial_reserva: 0,
    }
    .validate()
    .is_err());
    assert!(SettingsInput {
        primeiro_mes: None,
        saldo_inicial_conta: -1,
        saldo_inicial_reserva: 0,
    }
    .validate()
    .is_err());
    assert!(SettingsInput {
        primeiro_mes: None,
        saldo_inicial_conta: 0,
        saldo_inicial_reserva: 10,
    }
    .validate()
    .is_ok());
}
```

- [ ] **Step 2: Rodar os testes**

Run: `rtk cargo test --manifest-path src-tauri/Cargo.toml`
Expected: todos passam (incluindo os 6 novos).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tests/settings_test.rs
git commit -m "test: settings (piso, saldos iniciais, series)"
```

---

### Task 9: Frontend types, api, queries, month-context

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/api.ts`
- Modify: `lib/queries.ts`
- Modify: `lib/month-context.tsx`

- [ ] **Step 1: Types em `lib/types.ts`**

Adicione ao final:

```ts
export interface Settings {
  primeiro_mes: string | null;
  saldo_inicial_conta: number;
  saldo_inicial_reserva: number;
}

export interface SettingsInput {
  primeiro_mes: string | null;
  saldo_inicial_conta: number;
  saldo_inicial_reserva: number;
}
```

- [ ] **Step 2: API em `lib/api.ts`**

No objeto `api`, após `listReservaMovements`:

```ts
  getSettings: () => invoke<Settings>("get_settings"),
  updateSettings: (input: SettingsInput) => invoke<void>("update_settings", { input }),
```

E na importação de tipos adicione `Settings, SettingsInput`.

- [ ] **Step 3: Queries em `lib/queries.ts`**

No `queryKeys`, adicione:

```ts
  settings: ["settings"] as const,
  earliestMonth: ["earliest-month"] as const,
```

E adicione os hooks:

```ts
export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api.getSettings(),
    staleTime: 15_000,
  });
}

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsInput) => api.updateSettings(input),
    onSuccess: () => {
      // ponytail: DB global único; invalidar tudo é simples e suficiente.
      void client.invalidateQueries();
    },
  });
}
```

Atualize a importação de tipos em `lib/queries.ts` para incluir `SettingsInput`.

- [ ] **Step 4: MonthProvider usa query de earliest-month**

Em `lib/month-context.tsx`, mantenha o `useEffect` de localStorage (já usa
`eslint-disable-line react-hooks/set-state-in-effect`) e troque só o estado
`min` por `useQuery`:

```tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { queryKeys } from "./queries";

interface MonthCtx {
  month: string;
  setMonth: (m: string) => void;
  min: string;
}

const Ctx = createContext<MonthCtx>({ month: "", setMonth: () => {}, min: "" });

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const today = new Date().toISOString().slice(0, 7);
  const [month, setMonthState] = useState(today);

  const earliest = useQuery({
    queryKey: queryKeys.earliestMonth,
    queryFn: () => api.getEarliestMonth(),
    staleTime: 60_000,
  });

  useEffect(() => {
    const saved = localStorage.getItem("filterMonth");
    if (saved) setMonthState(saved); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const setMonth = (m: string) => {
    setMonthState(m);
    localStorage.setItem("filterMonth", m);
  };

  return (
    <Ctx.Provider value={{ month, setMonth, min: earliest.data ?? today }}>
      {children}
    </Ctx.Provider>
  );
}

export const useMonth = () => useContext(Ctx);
```

> O `min` reativo vem da invalidação: ao salvar configurações, `invalidateQueries()`
> refaz `earliest-month` e o MonthPicker passa a limitar no primeiro mês.

- [ ] **Step 5: Typecheck e lint**

Run: `bun run typecheck && bun run lint`
Expected: ambos sem erro.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/api.ts lib/queries.ts lib/month-context.tsx
git commit -m "feat: settings no frontend e earliest-month via react-query"
```

---

### Task 10: Página /configuracoes

**Files:**
- Create: `app/configuracoes/page.tsx`

- [ ] **Step 1: Criar a página**

Crie `app/configuracoes/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { MonthPicker } from "@/components/MonthPicker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { Spinner } from "@/components/ui/spinner";
import { useSettings, useUpdateSettings } from "@/lib/queries";
import { msg } from "@/lib/api";
import type { Settings } from "@/lib/types";

export default function ConfiguracoesPage() {
  const { data: settings, isLoading } = useSettings();
  if (isLoading || !settings) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
      <SettingsForm key={JSON.stringify(settings)} settings={settings} />
    </div>
  );
}

function SettingsForm({ settings }: { settings: Settings }) {
  const [primeiroMes, setPrimeiroMes] = useState(settings.primeiro_mes ?? "");
  const [conta, setConta] = useState(settings.saldo_inicial_conta);
  const [reserva, setReserva] = useState(settings.saldo_inicial_reserva);
  const update = useUpdateSettings();

  const save = () =>
    update.mutate(
      {
        primeiro_mes: primeiroMes === "" ? null : primeiroMes,
        saldo_inicial_conta: conta,
        saldo_inicial_reserva: reserva,
      },
      {
        onSuccess: () => toast.add({ title: "Configurações salvas", type: "success" }),
        onError: (e) => toast.add({ title: msg(e), type: "error" }),
      }
    );

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Análises</CardTitle></CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Primeiro mês de uso</FieldLabel>
            <MonthPicker value={primeiroMes} onChange={setPrimeiroMes} />
            <p className="text-xs text-muted-foreground">
              Nenhum dado anterior a esse mês entra nos dashboards.
            </p>
          </Field>
          <Field>
            <FieldLabel>Saldo inicial da conta (R$)</FieldLabel>
            <MoneyInput value={conta} onChange={setConta} />
            <p className="text-xs text-muted-foreground">
              Quanto existia na conta no primeiro mês de uso.
            </p>
          </Field>
          <Field>
            <FieldLabel>Saldo inicial da reserva (R$)</FieldLabel>
            <MoneyInput value={reserva} onChange={setReserva} />
            <p className="text-xs text-muted-foreground">
              Quanto existia na reserva no primeiro mês de uso.
            </p>
          </Field>
          <Button onClick={save} disabled={update.isPending} className="w-full">
            {update.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck e lint**

Run: `bun run typecheck && bun run lint`
Expected: ambos sem erro.

- [ ] **Step 3: Commit**

```bash
git add app/configuracoes/page.tsx
git commit -m "feat: pagina de configuracoes"
```

---

### Task 11: Navegação + resumo da reserva com saldo inicial

**Files:**
- Modify: `components/Sidebar.tsx`
- Modify: `components/BottomBar.tsx`
- Modify: `components/MobileHeader.tsx`
- Modify: `app/reserva/page.tsx`

- [ ] **Step 1: Sidebar**

Em `components/Sidebar.tsx`, adicione `Settings` aos imports do lucide e o item no `NAV` (após `Reserva`):

```tsx
import { ..., Settings } from "lucide-react";
...
  { href: "/configuracoes", label: "Configurações", icon: Settings },
```

- [ ] **Step 2: BottomBar**

Em `components/BottomBar.tsx`, adicione `Settings` ao import do lucide e o item no `MORE` (após `Reserva`):

```tsx
  { href: "/configuracoes", label: "Configurações", icon: Settings },
```

- [ ] **Step 3: MobileHeader**

Em `components/MobileHeader.tsx`, adicione ao `TITLES`:

```tsx
  "/configuracoes": "Configurações",
```

- [ ] **Step 4: Resumo da reserva soma o saldo inicial**

Em `app/reserva/page.tsx`, use o settings na soma do saldo:

```tsx
import { useSettings } from "@/lib/queries";
...
export default function ReservaPage() {
  const { month } = useMonth();
  const { data: settings } = useSettings();
  const seed = settings?.saldo_inicial_reserva ?? 0;
  const load = useCallback(() => api.listReservaMovements(), []);

  const balance = useCallback(
    (rows: TransactionRow[]) => {
      const saldo = seed + rows.reduce((acc, r) => acc + (r.type === 5 ? -r.amount : r.amount), 0);
      return (
        <Card className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">Saldo da reserva</span>
          <span className={cn("text-lg font-semibold font-mono", saldo < 0 ? "text-negative" : "text-positive")}>
            {formatMoney(saldo)}
          </span>
        </Card>
      );
    },
    [seed]
  );
  ...
}
```

- [ ] **Step 5: Typecheck e lint**

Run: `bun run typecheck && bun run lint`
Expected: ambos sem erro.

- [ ] **Step 6: Commit**

```bash
git add components/Sidebar.tsx components/BottomBar.tsx components/MobileHeader.tsx app/reserva/page.tsx
git commit -m "feat: navegacao de configuracoes e saldo inicial na reserva"
```

---

### Task 12: Verificação final

- [ ] **Step 1: Suíte completa**

Run: `rtk cargo test --manifest-path src-tauri/Cargo.toml`
Expected: todos os testes passam (58+).

- [ ] **Step 2: Typecheck e lint**

Run: `bun run typecheck && bun run lint`
Expected: sem erros.

- [ ] **Step 3: Smoke test no dev**

Run: `bun tauri dev`
Expected: app abre; acessar `/configuracoes`, salvar primeiro mês e saldos; MonthPicker do header não navega antes do primeiro mês; gráfico começa no primeiro mês; dashboard "Saldo acumulado" reflete o saldo inicial; reserva mostra saldo com o inicial.

- [ ] **Step 4: Commit final (se houver ajustes)**
