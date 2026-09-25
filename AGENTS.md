<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Regras de UI/UX

- Todas as datas exibidas na UI devem usar o formato **DD/MM/YYYY** (ex.: `31/12/2026`). Usar sempre `formatDate` de `lib/format.ts`; nunca renderizar data crua (`YYYY-MM-DD`) direto no JSX.

## Padrão de telas de cadastro (FormDialog / CRUD)

- Todo form de cadastro é organizado em **`FormSection` com ícone lucide** — nunca campo solto de seção.
- **1ª seção sempre "Identificação"** (ícone `FileText`): tipo + nome/descrição.
- Sem divider no header dos modais (`DialogHeader` default `showSeparator=false`) — as seções já separam. Campo avulso só em caso de ficar órfão (ex.: toggle de comportamento sem grupo natural).
- Ícones padrão: Identificação → `FileText`; Valores → `Banknote` (dinheiro + data); Pagamento → `Wallet` (forma de pagamento, categoria, modo cartão); Parcelas/Duração → `Repeat`; Vencimento/Compra no cartão → `CalendarRange` / `CreditCard`; Taxa/juros → `Percent`; Aparência → `Palette`.
- Seção sem campos não renderiza (ex.: Modo cartão só quando forma = cartão; Cartão de pagamento só quando tipo = cartão).
- Quick-create (categoria, forma de pagamento) vive na seção onde o select fica.

## Busca CRUD

- Input de busca com ícone `Search` posicionado `absolute left-2.5` exige `className="pl-9!"` no Input (sufixo `!` obrigatório — `data-[size=lg]:px-3.5` do Input tem especificidade maior que um simples `pl-8` e o placeholder invade o ícone).

# Stack

- Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4. **NÃO é o Next.js padrão** — APIs/convenções podem diferir; ler `node_modules/next/dist/docs/` antes de escrever código.
- UI primitivas em `components/ui/` no estilo shadcn baseado em `@base-ui/react` (button, sheet, dialog, card…). Ícones `lucide-react`. Validação `zod`. TanStack: react-query / react-form / react-table / charts.
- Backend desktop/mobile: Tauri v2 em `src-tauri/` (Rust). Comandos expostos via `invoke` (`@tauri-apps/api/core`).
- Gerenciador: **bun**. Scripts: `bun run dev`, `bun run build`, `bun run lint`, `bun run typecheck`, `bun run format` (prettier), `bun tauri …`.

# Estrutura de pastas

```
app/                     rotas Next.js App Router
  <modulo>/page.tsx      rota por domínio (categorias, configuracoes, transactions…)
  layout.tsx             root: Providers, PlatformProvider, AppShell, ThemeProvider, Toaster, SafeAreaInit
lib/                     helpers core
  platform.ts{x}         PlatformProvider + usePlatform ("mobile"|"desktop")
  format.ts              formatDate (DD/MM/YYYY), formatMoney, formatMonth, shiftMonth
  month-context.tsx      mês global (month/setMonth/min) — uso ubíquo
  use-is-mobile.ts       matchMedia(max-width:639px)
  schemas.ts / forms.ts  zod + form helpers
components/
  crud/                  engine CRUD genérica
    CrudPage.tsx         dispatcher → PlatformView(CrudPageDesktop|CrudPageMobile)
    CrudPageMobile.tsx   toolbar 2 linhas + FAB; CrudPageDesktop.tsx tabela/filtros
    FormDialog.tsx / ViewDialog.tsx   form e view (sheet top no mobile, dialog no desktop)
    FilterMenu/FilterBar/FilterChip/RowActionsMenu/CardList/DataTable/use-crud-page/use-filter-params
  screens/<modulo>/      telas por domínio (dashboard, configuracoes, categoria…)
    index.tsx            PlataformView(mobile, desktop) + subpastas mobile/ desktop/ shared/
  ui/                    primitivas shadcn/base-ui (NÃO usar shadcn auto-import; editar direto)
src/                     domínios de negócio (front)
  Accounts/              contas + shell de navegação (AppShell, AccountRail desktop, AccountBottomNav mobile, AccountSwitcherSheet, AccountDialogs, ChannelsContent, models/services)
  OrganizacaoFinanceira/ e Investimentos/: Models/Repositories/Services/Views
  shared/                models/repository/services comuns (useDashboard, getVersion…)
  Sync/                  Google Connect + sync (settings/status/overlay)
src-tauri/
  src/                   backend Rust por domínio: accounts/, organizacao_financeira/, investimentos/, google/, sync/, shared/ + lib.rs (get_platform_type etc.)
  gen/                   Android gerado (~182MB) — gitignored, NUNCA commitar
```

# Padrões de plataforma (mobile × desktop)

- Detecção: `isTauri() + invoke("get_platform_type")`; fallback `matchMedia("(max-width: 639px)")`. SSR-safe (default "desktop", resolve no `useEffect`).
- `PlatformView({ mobile, desktop })` renderiza conforme `usePlatform()`. Toda tela segue `<Modulo>/index.tsx` com `mobile/`, `desktop/`, `shared/`.
- **Suspense obrigatório** em qualquer rota/componente que use `useSearchParams` (engine CRUD)
- `useIsMobile()` = breakpoint `sm` (639px). Para layout puro preferir classes `sm:`/`md:`; `useIsMobile` para lógica/handlers.

# Regras de UI mobile (estado atual)

- Nav inferior: `AccountBottomNav` (flutuante, centralizado, só mobile) = [avatar da conta] [MonthPicker] [Config]. Drawer de canais da conta abre pelo hambúrguer no `AppHeader`; situação do mês (`MonthStatusBadge`) fica no header (sempre visível).
- **TODO modal segue o padrão do CRUD modal**: mobile = `Sheet side="top"`, desktop = `Dialog`. Estrutura: `Dialog/SheetHeader` + Title, rodapé de ações; Cancelar `variant="outline"` + submit `className="rounded-md"`. **Nunca** aninhar `DialogHeader` dentro de `SheetContent` (duplica o X de fechar — o sheet já renderiza o dele).
- Sheets que ficam **bottom** (exceções): ConfirmDialog, CardOptionsSheet, ViewForms de fatura/financiamento, UpdateDialog.
- Gutter de sheets: `inset-x-3` + `rounded-2xl` + `px-4`; safe-areas via `var(--safe-area-inset-*)`.
- FAB dos CRUD mobile: `fixed right-4 bottom-[calc(7.5rem+var(--safe-area-inset-bottom))]` (acima da nav bar).

# Lint / React Compiler

- `react-hooks/set-state-in-effect`: resetar estado (ex.: lotes de infinite scroll, form sync) nos **handlers**, nunca em `useEffect`.
- Destructure hooks/contexto antes de usar no JSX; não criar memos manuais que o compiler manda preservar.
- Rodar `bun run typecheck && bun run lint` (e `bun run build`) antes de build Android / commit.

# Git / GitHub

- Default branch: `master`. Fluxo: feature branch → PR → merge fecha issue com **"Closes #N"** no PR/commit body.
- Repo: `DevDanielCh/AjudaFinancasTauri` (gh CLI disponível).
- Nunca commitar `src-tauri/gen/` nem `.next/`.

# Lições aprendidas

## Toque longo / long-press (Android WebView)
- WebView dispara `pointercancel` ao iniciar seleção de texto — usar `select-none` em cards touch, senão o gesto de long-press morre.
- Micro-jitter do dedo dispara `pointermove` — cancelar o timer do long-press só após deslocamento >10px (`Math.hypot`).
- Não usar `onContextMenu` junto com timer (duplica a ação no Android).
- Após long-press o browser pode não disparar `click` no mesmo elemento — resetar `suppressClick` no próximo `pointerdown` (senão engole o próximo tap).

## Pull-to-refresh
- Ativar só com `window.scrollY <= 0` e fora de sheets/dialogs (`[data-slot="sheet-content"]`, `[data-slot="dialog-panel"]`).
- Listener `touchmove` precisa `{ passive: false }` + `preventDefault()` enquanto puxa.
- Spinner: `fixed` + `pointer-events-none`, posicionado com `translateY`.
- Guardar callback num `ref` para evitar recriar listeners no `useEffect` vazio.

## Infinite scroll
- Dados ficam todos em memória; `IntersectionObserver` + sentinel com `rootMargin: 200px` carrega lotes.
- Reset do lote no search e no reload — NÃO via `useEffect` (lint `react-hooks/set-state-in-effect` bloqueia; resetar explicitamente nos handlers).

## Build Android (Tauri)
- `src-tauri/gen/` é gerado (~182MB) — ignorado no git, nunca commitar.
- Fluxo build + sign + install:
  - `export ANDROID_HOME=~/Android/Sdk NDK_HOME=~/Android/Sdk/ndk/25.2.9519653 JAVA_HOME=~/jdk17 PATH=~/jdk17/bin:$PATH`
  - `bun tauri android build --apk --target armv7`
  - `apksigner sign --ks ~/Android/debug.keystore --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out <signed.apk> <unsigned.apk>`
  - `adb install -r <signed.apk> && adb shell am force-stop com.ajudafinancas.app` + relançar com `adb shell monkey -p com.ajudafinancas.app -c android.intent.category.LAUNCHER 1`
- APK assinado em `src-tauri/gen/android/app/build/outputs/apk/universal/release/ajudafinancas-mobile.apk` (unsigned: `app-universal-release-unsigned.apk`).
- Validar instalação com `adb shell pidof com.ajudafinancas.app` (PID ≠ vazio).
- Dispositivo de teste: Xiaomi Mi 11 (alioth) via `adb connect 192.168.3.36:39837` (adb wireless; `~/Android/Sdk/platform-tools/adb`). Se `adb install` incrementa falhar na parse, o `adb install -r` streamed cobre.
