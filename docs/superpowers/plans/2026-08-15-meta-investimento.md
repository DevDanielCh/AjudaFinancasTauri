# Meta de Investimento no Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Novo card "Meta de investimento" no dashboard comparando aportes à reserva (type 4) do mês contra uma porcentagem configurável das receitas do mês.

**Architecture:** Config nova `meta_investimento` (f64, %) persistida na tabela key-value `settings` (sem migration — tabela já genérica). Backend expõe `meta_investimento` e `aportes` no `DashboardData`. Frontend calcula `metaValor = round(income × pct / 100)` e exibe card com badge batida/não batida.

**Tech Stack:** Rust (Tauri), rusqlite, React (Next.js App Router), @tanstack/react-query.

**Convenções:** moeda em centavos (`i64`); datas exibidas só via `formatDate` de `lib/format.ts`. Porcentagem `meta_investimento` é valor real 0–100 (ex.: 12.5 = 12,5% da renda). Card escondido quando `meta_investimento <= 0` (não configurada).

---

### Task 1: Backend — campo `meta_investimento` em Settings

**Files:**
- Modify: `src-tauri/src/models.rs:342-377`
- Test: `src-tauri/src/domain.rs` (módulo `tests`)

- [ ] **Step 1: Adicionar campo nos modelos**

Em `src-tauri/src/models.rs`, no struct `Settings`:
```rust
#[serde(default)]
pub meta_investimento: f64,
```
No struct `SettingsInput`, após `saldo_inicial_reserva`:
```rust
pub meta_investimento: f64,
```
No `impl SettingsInput { pub fn validate() }`, após o check de saldos:
```rust
if !(0.0..=100.0).contains(&self.meta_investimento) {
    return Err("meta de investimento deve ser entre 0 e 100".into());
}
```

- [ ] **Step 2: get/set no domain**

Em `src-tauri/src/domain.rs` `get_settings` (linha ~86), adicionar ao `match`:
```rust
"meta_investimento" => s.meta_investimento = v.parse().unwrap_or(0.0),
```
Em `set_settings` (linha ~105), adicionar à lista do `for`:
```rust
("meta_investimento", input.meta_investimento.to_string()),
```

- [ ] **Step 3: Teste de roundtrip**

No módulo `#[cfg(test)] mod tests` de `domain.rs`, adicionar:
```rust
#[test]
fn settings_roundtrip_inclui_meta_investimento() {
    let conn = test_db();
    let input = crate::models::SettingsInput {
        primeiro_mes: None,
        saldo_inicial_conta: 0,
        saldo_inicial_reserva: 0,
        meta_investimento: 12.5,
    };
    assert!(input.validate().is_ok());
    set_settings(&conn, &input).unwrap();
    let s = get_settings(&conn).unwrap();
    assert_eq!(s.meta_investimento, 12.5);

    let inv = crate::models::SettingsInput {
        primeiro_mes: None,
        saldo_inicial_conta: 0,
        saldo_inicial_reserva: 0,
        meta_investimento: 150.0,
    };
    assert!(inv.validate().is_err(), "acima de 100 deve falhar");
}
```

- [ ] **Step 4: Rodar testes**

Run: `cargo test` (dentro de `src-tauri/`)
Expected: PASS, incluindo `settings_roundtrip_inclui_meta_investimento`.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/models.rs src-tauri/src/domain.rs
git commit -m "feat: campo meta_investimento nas configurações"
```

---

### Task 2: Backend — `month_investments` e DashboardData

**Files:**
- Modify: `src-tauri/src/domain.rs` (perto de `month_income`, linha ~162)
- Modify: `src-tauri/src/models.rs:314-323`
- Modify: `src-tauri/src/commands/dashboard.rs`
- Test: `src-tauri/src/domain.rs`

- [ ] **Step 1: Função de aportes**

Em `domain.rs`, logo após `month_income`:
```rust
/// Soma dos aportes à reserva (type = 4) no período.
pub fn month_investments(conn: &Connection, start: NaiveDate, end: NaiveDate) -> Result<i64, String> {
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE type = 4 AND date >= ?1 AND date < ?2",
            rusqlite::params![start.format("%Y-%m-%d").to_string(), end.format("%Y-%m-%d").to_string()],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(v)
}
```

- [ ] **Step 2: Teste da função**

No módulo `tests` de `domain.rs`:
```rust
#[test]
fn month_investments_soma_aportes_do_mes() {
    let conn = test_db();
    conn.execute_batch(
        "INSERT INTO transactions (description, amount, type, date) VALUES
         ('aporte', 1000, 4, '2026-06-10'),
         ('resgate', 300, 5, '2026-06-15'),
         ('despesa', 500, 2, '2026-06-20'),
         ('aporte', 2000, 4, '2026-07-01')",
    )
    .unwrap();
    let jun = NaiveDate::from_ymd_opt(2026, 6, 1).unwrap();
    let jul = NaiveDate::from_ymd_opt(2026, 7, 1).unwrap();
    assert_eq!(month_investments(&conn, jun, jul).unwrap(), 1000, "só type 4 do mês");
}
```

- [ ] **Step 3: DashboardData com meta e aportes**

Em `models.rs`, struct `DashboardData` (linha ~315), adicionar ao final:
```rust
/// Percentual configurado das receitas destinado a investimentos (0–100).
pub meta_investimento: f64,
/// Aportes à reserva (type 4) no mês.
pub aportes: i64,
```

- [ ] **Step 4: Compor no build**

Em `src-tauri/src/commands/dashboard.rs` `build`, após o bloco `let settings = ...`:
```rust
let next = ref_month.checked_add_months(Months::new(1)).unwrap();
let aportes = domain::month_investments(conn, ref_month, next)?;
```
No construtor `Ok(DashboardData { ... })`, adicionar:
```rust
meta_investimento: settings.meta_investimento,
aportes,
```
(remover a linha `let next = ...` duplicada se já existir — `next` já é declarado na linha 29 do arquivo atual; usar essa variável em vez de redeclarar).

- [ ] **Step 5: Rodar testes**

Run: `cargo test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/domain.rs src-tauri/src/models.rs src-tauri/src/commands/dashboard.rs
git commit -m "feat: dashboard expõe meta de investimento e aportes do mês"
```

---

### Task 3: Frontend — tipos e config de porcentagem

**Files:**
- Modify: `lib/types.ts:150-184`
- Modify: `app/configuracoes/page.tsx`

- [ ] **Step 1: Tipos**

Em `lib/types.ts`:
- `interface Settings` e `interface SettingsInput`: adicionar `meta_investimento: number;`
- `interface DashboardData`: adicionar `meta_investimento: number;` e `aportes: number;`

- [ ] **Step 2: Campo na tela de configurações**

Em `app/configuracoes/page.tsx`:
- Adicionar import: `import { Input } from "@/components/ui/input";`
- No `SettingsForm`, novo estado: `const [meta, setMeta] = useState(settings.meta_investimento);`
- No payload de `update.mutate`, adicionar `meta_investimento: meta,`
- Adicionar campo após o de `saldo_inicial_reserva`:
```tsx
<Field>
  <FieldLabel>Meta de investimento (% da renda)</FieldLabel>
  <Input
    type="number"
    min={0}
    max={100}
    step={0.1}
    value={meta}
    onChange={(e) => setMeta(Number(e.target.value))}
  />
  <p className="text-xs text-muted-foreground">
    Percentual das receitas do mês destinado a investimentos.
  </p>
</Field>
```

- [ ] **Step 3: Verificação**

Run: `bun run typecheck` e `bun run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts app/configuracoes/page.tsx
git commit -m "feat: configuração da meta de investimento (%)"
```

---

### Task 4: Frontend — card da meta no dashboard

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/ui/badge.tsx` (já existe, só importar)

- [ ] **Step 1: Card**

Em `app/page.tsx`:
- Adicionar import: `import { Badge } from "@/components/ui/badge";`
- Dentro do bloco `<>...</>` após o `<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">...</div>`, adicionar:
```tsx
{data.meta_investimento > 0 && (
  <MetaCard pct={data.meta_investimento} income={data.income} aportes={data.aportes} />
)}
```
- Definir componente ao final do arquivo:
```tsx
function MetaCard({ pct, income, aportes }: { pct: number; income: number; aportes: number }) {
  const metaValor = Math.round((income * pct) / 100);
  const atingiu = aportes >= metaValor;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
          Meta de investimento
          <Badge className={atingiu ? "" : "bg-negative text-negative-foreground"}>
            {atingiu ? "Meta batida" : "Não bateu"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className={cn("text-2xl font-bold tabular-nums font-mono", atingiu ? "text-positive" : "text-negative")}>
          {formatMoney(metaValor)}
        </div>
        <p className="text-sm text-muted-foreground">
          {pct}% da renda · aportado {formatMoney(aportes)} no mês
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verificação**

Run: `bun run typecheck` e `bun run lint`
Expected: sem erros.

- [ ] **Step 3: Teste manual**

Run: `bun run dev`
Com `meta_investimento = 10`, `income = R$ 1.000,00` e `aportes = R$ 150,00`: card mostra R$ 100,00 "Meta batida". Com `aportes = R$ 50,00`: "Não bateu". Com `meta_investimento = 0`: card ausente.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: card de meta de investimento no dashboard"
```

---

### Task 5: Self-review — verificação final

- [ ] **Step 1: Suite completa backend**

Run: `cargo test` (em `src-tauri/`)
Expected: todos PASS.

- [ ] **Step 2: Build frontend**

Run: `bun run build`
Expected: build limpo.

- [ ] **Step 3: Checklist da spec**

- [ ] Config de % salva e lida (task 1–2)
- [ ] Meta calculada sobre `income` do mês (task 4)
- [ ] Aportes = adições type 4 do mês (task 2)
- [ ] Badge mostra batida/não batida (task 4)
- [ ] Card some quando % = 0 (task 4)

- [ ] **Step 4: Commit final (se houver ajuste)**

```bash
git add -A
git commit -m "chore: ajustes finais da meta de investimento"
```
