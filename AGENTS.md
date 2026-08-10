<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Regras de UI/UX

- Todas as datas exibidas na UI devem usar o formato **DD-MM-YYYY** (ex.: `31-12-2026`). Usar sempre `formatDate` de `lib/format.ts`; nunca renderizar data crua (`YYYY-MM-DD`) direto no JSX.
- Datas com o separador `/` (DD/MM/YYYY) são proibidas na UI.

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
