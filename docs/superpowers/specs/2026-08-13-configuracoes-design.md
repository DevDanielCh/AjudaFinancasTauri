# Tela de Configurações: primeiro mês de uso + saldos iniciais

Data: 2026-08-13

## Objetivo

Tela de configurações que define três valores globais:

1. **Primeiro mês de uso** — piso rígido de todas as análises do app.
2. **Saldo inicial da conta** — semente do saldo acumulado.
3. **Saldo inicial da reserva** — semente do saldo da reserva.

## Semântica

- O usuário passou a usar o app em `primeiro_mes`. Transações anteriores a ele
  (lixo, importação antiga) não participam de nenhuma análise.
- Os saldos iniciais representam quanto existia nas contas em `primeiro_mes`.
- Sem configuração, o comportamento atual é mantido (janela de 12 meses, saldo
  acumulando de zero, primeiro mês = transação mais antiga).

## Backend

### Migração `008_settings.sql`

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Chaves: `primeiro_mes` ("YYYY-MM"), `saldo_inicial_conta` (i64 centavos),
`saldo_inicial_reserva` (i64 centavos). Registrada em `db.rs` (8 migrações).

### Models

```rust
pub struct Settings {
    pub primeiro_mes: Option<String>,
    pub saldo_inicial_conta: i64,
    pub saldo_inicial_reserva: i64,
}

pub struct SettingsInput {
    pub primeiro_mes: Option<String>,
    pub saldo_inicial_conta: i64,
    pub saldo_inicial_reserva: i64,
}
```

`SettingsInput::validate()`: mês em formato `YYYY-MM` (se presente) e não
posterior ao mês corrente; saldos >= 0.

### Comandos (`commands/settings.rs`)

- `get_settings() -> Settings` — defaults: `None`, 0, 0.
- `update_settings(input) -> ()` — valida e grava as 3 chaves (INSERT OR
  REPLACE). Registrados em `lib.rs`.

### Leitura em domain.rs

Helper `settings(conn) -> Settings` lê as chaves (defaults idênticos).

- **`get_earliest_month`**: retorna `primeiro_mes` se configurado, senão o
  `MIN(date)` atual.
- **`reserva_balance_at(conn, before)`**: `saldo_inicial_reserva` +
  `SUM(CASE type 4→+amount, type 5→−amount) WHERE date >= primeiro_mes AND date < before`.
  Sem `primeiro_mes`, mantém o comportamento atual (histórico completo).
- **`account_balance_at(conn, before)`** (novo): itera meses de `primeiro_mes`
  (ou `earliest_month`) até `before`, acumulando `month_income − month_expenses`,
  partindo de `saldo_inicial_conta`.
- **`monthly_series(conn, ref_month, months)`**: mantém o parâmetro `months`
  (12). Quando `primeiro_mes` configurado, a janela exibida é
  `[primeiro_mes, ref_month]` (quantos pontos couberem, ignorando `months`);
  sem config, janela = `[ref_month − months + 1, ref_month]` (comportamento
  atual). `balance` usa `account_balance_at(next)`; `reserva` usa
  `reserva_balance_at(next)`. Sem config, acumulação interna atual é mantida.
- **`list_reserva_movements`**: filtra `date >= primeiro_mes` quando configurado
  (consistência com o card de saldo da tela e o gráfico).

### Dashboard (`commands/dashboard.rs`)

- `balance = account_balance_at(conn, next_month)` (posição), 
  `prev_balance = account_balance_at(conn, ref_month)`.
- `month_income`/`month_expenses` do mês corrente inalterados (o mês já é >=
  piso por causa da navegação).

## Frontend

- `lib/types.ts`: `Settings`, `SettingsInput`.
- `lib/api.ts`: `getSettings`, `updateSettings`.
- `lib/queries.ts`: `queryKeys.settings`, `useSettings`, `useUpdateSettings`
  (invalida dashboard/chart/reserva/settings + `get_earliest_month`).
- `lib/month-context.tsx`: `api.getEarliestMonth` vira query react-query com
  `queryKeys.earliestMonth` — o `min` do MonthPicker reage à invalidação do
  settings (o próprio comando já retorna `primeiro_mes` quando configurado).
- `app/configuracoes/page.tsx`: form simples (não-CrudPage) — MonthPicker
  compacto para o primeiro mês, 2 MoneyInputs, botão Salvar, toast de erro/sucesso.
- Navegação: item "Configurações" no `Sidebar`, no `MORE` do `BottomBar`,
  título no `MobileHeader`.
- Tela de reserva: card de saldo soma `saldo_inicial_reserva` + movimentos.

## Fora de escopo

- Forms de cadastro NÃO são limitados pelo primeiro mês (decisão do usuário:
  só filtro global, mínimos dos dashboards e valores dos cálculos).
- Nenhuma mudança em `sync_generated`/contas fixas: transações geradas antes do
  piso apenas ficam fora das agregações.

## Testes

- `account_balance_at`: piso exclui fluxos anteriores; saldo inicial soma;
  posição por mês correta.
- `reserva_balance_at`: saldo inicial + piso; sem piso mantém histórico.
- `monthly_series`: começa no primeiro mês configurado; sem config mantém 12.
- `get_earliest_month`: respeita `primeiro_mes`.
- `update_settings`: validação de mês inválido/futuro e saldos negativos.
