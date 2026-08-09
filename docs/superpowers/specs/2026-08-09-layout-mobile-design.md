# Layout Mobile — Ajuda Finanças

Data: 2026-08-09
Status: Aprovado

## Contexto

App Tauri v2 + Next.js (export estático) roda no Android. Layout atual é desktop-first: Sidebar fixa à esquerda, DataTable com colunas, dialogs centrais. Em 360px de largura não funciona.

Objetivo: layout mobile nativo-feeling **sem** tocar backend/API/banco. Só camada de UI, por breakpoint.

## Princípios

- **Responsive por breakpoint**, não app separado. Desktop (>= 640px) mantém o que existe hoje 100%. Mobile troca o shell.
- Zero mudança em `lib/api`, tipos, migrations, Rust.
- Reuso de componentes UI existentes (Sheet, Drawer, Button, etc).
- Padrões mobile: bottom bar flutuante glass (estilo Instagram), bottom sheets, cards no lugar de tabelas, toque longo pra ações.

## 1. Shell (app/layout.tsx + components)

### Mobile (< 640px)

- **Header fixo no topo** (`sticky`):
  - Esquerda: título da página atual.
  - Direita: pill do mês (`◂ Julho 2026 ▸`, abre MonthPicker) + toggle de tema.
- **Bottom bar flutuante glass**: pill centralizada, `rounded-full`, `backdrop-blur`, borda translúcida, sombra. 4 ícones:
  1. Dashboard (`/`)
  2. Transações (`/transactions`)
  3. Parcelamentos (`/installments`)
  4. Mais → abre **bottom sheet "Mais"** com lista simples:
     - Formas de Pagamento (`/payment-methods`)
     - Categorias (`/categories`)
     - Contas Fixas (`/fixed-bills`)
     - Financiamentos (`/loans`)
  - Item ativo destacado (fundo escuro/acento).
- **Sidebar desktop**: oculta no mobile (`hidden md:flex` ou condicional por `useIsMobile`).
- Main com padding e margem inferior suficiente pra não sobrepor a bottom bar.

### Desktop (>= 640px)

Sidebar atual intacta.

## 2. Cards (CrudPage)

Mobile renderiza **lista de cards** no lugar do `DataTable`. Tabela permanece no desktop.

### Card 4 cantos

```
┌────────────────────────────────┐
│ Título (sup. esq)    Valor     │
│ Categoria/Tipo       Data      │
└────────────────────────────────┘
```

- **sup. esq**: campo principal (ex.: descrição/nome)
- **inf. esq**: categoria/tipo (ex.: categoria · dia)
- **sup. dir**: valor, cor por sinal (`text-positive` receita, `text-negative` despesa), `font-mono`, sinal `+`/`−`
- **inf. dir**: data/info secundária (formatada DD-MM-YYYY)
- Páginas sem valor/data (Categorias, Formas de Pagamento): cantos de valor/data carregam info secundária ou ficam vazios.

### Mapeamento por página

| Página | sup.esq | inf.esq | sup.dir | inf.dir |
|---|---|---|---|---|
| Transações | descrição | categoria | valor (±cor) | data |
| Parcelamentos | descrição | categoria · dia | valor | início → fim |
| Contas Fixas | descrição | categoria · dia | valor | início → fim |
| Financiamentos | descrição | tipo · X/N | valor parcela | início → fim |
| Categorias | cor + nome | — | tipo | — |
| Formas de Pagamento | nome | tipo | — | fechamento/vencimento |

### Interações

- **Toque simples**: abre Visualizar (FaturaDetailDialog pra faturas, DetailDialog pra financiamentos, toast "Visualizar disponível apenas para faturas" nos demais, conforme `onView` de cada página).
- **Toque longo**: abre bottom sheet de opções do registro: **Visualizar / Editar / Excluir**. Registros protegidos (faturas) sem Editar/Excluir.
- Busca, "Adicionar", paginação, contagem de registros e recarregar: mantidos no mobile (dispostos pra tela pequena).

### Implementação

- Estender `CrudConfig` com config de card mobile (campos + acessórios por canto) — ex.: `mobileCorners`.
- `CrudPage` decide entre `DataTable` (desktop) e `CardList` (mobile) pelo mesmo breakpoint.
- `protected`, `onView`, `onRowDoubleClick` continuam valendo.

## 3. Forms e modais

- **FormDialog**: bottom sheet no mobile (reuso `Sheet` ou `Drawer`), dialog central no desktop.
- **ConfirmDialog**: bottom sheet de confirmação no mobile, dialog no desktop.
- **Dialogs de detalhe** (FaturaDetailDialog, DetailDialog de financiamentos, UpdateDialog): idem — bottom sheet no mobile.
- Wrapper único decide pelo breakpoint; conteúdo dos forms NÃO muda.

## 4. Dashboard

- Grid já `sm:grid-cols-2`, mobile fica 1 coluna. Ajustar padding/spacing só.

## 5. Arquitetura

- `useIsMobile()`: hook de matchMedia (`max-width: 639px`), reativo a resize. Decisão de layout centralizada.
- Novos componentes: `MobileHeader`, `BottomBar`, `MoreSheet`, `CardList`, `CardOptionsSheet`.
- `CrudConfig.mobileCorners`: opcional, tipado.
- Sem mudanças em `lib/api`, `lib/types`, `src-tauri`, migrations.

## 6. Erros e verificação

- Erros: mesmos `toast`/`msg` já usados.
- Verificação: `bun run typecheck`, `bun run lint`, `bun run build`; instalar APK no celular (armv7) e validar navegação, cards, toque longo, forms e detalhes em cada página.
