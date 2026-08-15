# CI Build Android no GitHub Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Workflow `mobile-android.yml` que builda APK Android universal assinado (debug keystore) e publica nos assets da release `v*`.

**Architecture:** Workflow isolado de `release.yml`. Triggers `v*` + `workflow_dispatch`. Job único em `ubuntu-latest` com Rust/Java 17/Android SDK (platform 36, build-tools 36.0.0, NDK 25.2.9519653)/Bun. `bun tauri android build --apk` (universal default), assina com keystore debug **cacheada** (assinatura estável entre runs → `adb install -r` funciona sem desinstalar), upload no release `v<version>` com wait-loop (tag push) ou `gh release create --draft` (dispatch).

**Tech Stack:** GitHub Actions, Tauri CLI v2 (`@tauri-apps/cli`), Bun, Java 17 (temurin), Android SDK build-tools + NDK.

**Spec:** `docs/superpowers/specs/2026-08-15-ci-android-build-design.md`

---

## File Structure

- Create: `.github/workflows/mobile-android.yml` — o workflow completo (1 job, 11 steps).
- Nada mais é alterado. `gen/` é gitignored; `tauri.settings.gradle` é regenerado pelo tauri-cli no runner.

## Detalhes de contexto

- `bun tauri` → script `tauri` do package.json → tauri-cli v2 local (devDependency `@tauri-apps/cli ^2`).
- `tauri android build` sem `--target` = universal (armv7 + arm64 + i686 + x86_64).
- `beforeBuildCommand: bun run build` (Next.js) roda automaticamente; output em `../out`.
- Saída do build: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`.
- Local sem parser YAML (`no pyyaml`/`no actionlint`) → validação com `bunx yaml-lint`.
- Upload usa `gh release upload`; o gh CLI não renomeia asset → copiar o APK para o nome final antes do upload.

---

### Task 1: Criar o workflow mobile-android.yml

**Files:**
- Create: `.github/workflows/mobile-android.yml`

- [ ] **Step 1: Criar o arquivo**

Conteúdo completo:

```yaml
name: Mobile Android

on:
  workflow_dispatch:
  push:
    tags:
      - "v*"

jobs:
  build-android-apk:
    permissions:
      contents: write
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: >-
            armv7-linux-androideabi,
            aarch64-linux-android,
            i686-linux-android,
            x86_64-linux-android

      - name: Rust cache
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      - name: Install Android SDK
        uses: android-actions/setup-android@v3
        with:
          packages: >-
            platform-tools,
            platforms;android-36,
            build-tools;36.0.0,
            ndk;25.2.9519653

      - name: Set NDK_HOME
        run: echo "NDK_HOME=$ANDROID_HOME/ndk/25.2.9519653" >> "$GITHUB_ENV"

      - name: Cache debug keystore
        uses: actions/cache@v4
        with:
          path: ~/.android/debug.keystore
          key: android-debug-keystore

      - name: Install Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.14

      - name: Install frontend dependencies
        run: bun install

      - name: Build Android APK
        run: bun tauri android build --apk

      - name: Sign APK with debug keystore
        run: |
          if [ ! -f "$HOME/.android/debug.keystore" ]; then
            keytool -genkeypair -v \
              -keystore "$HOME/.android/debug.keystore" \
              -alias androiddebugkey -storepass android -keypass android \
              -keyalg RSA -keysize 2048 -validity 10000 \
              -dname "CN=Android Debug,O=Android,C=US"
          fi
          "$ANDROID_HOME/build-tools/36.0.0/apksigner" sign \
            --ks "$HOME/.android/debug.keystore" \
            --ks-key-alias androiddebugkey \
            --ks-pass pass:android --key-pass pass:android \
            --out "$RUNNER_TEMP/ajudafinancas-mobile.apk" \
            src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk

      - name: Prepare APK asset
        id: apk
        run: |
          VERSION=$(jq -r .version src-tauri/tauri.conf.json)
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
          cp "$RUNNER_TEMP/ajudafinancas-mobile.apk" "$RUNNER_TEMP/ajudafinancas-$VERSION-android-universal.apk"

      - name: Ensure release exists
        shell: bash
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          VERSION="v${{ steps.apk.outputs.version }}"
          if [ "$GITHUB_EVENT_NAME" = "workflow_dispatch" ]; then
            gh release create "$VERSION" --draft 2>/dev/null || true
          else
            for _ in $(seq 1 40); do
              gh release view "$VERSION" >/dev/null 2>&1 && break
              sleep 15
            done
          fi

      - name: Upload APK to release
        shell: bash
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          VERSION="v${{ steps.apk.outputs.version }}"
          gh release upload "$VERSION" "$RUNNER_TEMP/ajudafinancas-${{ steps.apk.outputs.version }}-android-universal.apk" --clobber

      - name: Release summary
        shell: bash
        run: |
          echo "## Android APK" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "- Version: \`${{ steps.apk.outputs.version }}\`" >> "$GITHUB_STEP_SUMMARY"
          echo "- APK: \`ajudafinancas-${{ steps.apk.outputs.version }}-android-universal.apk\` (release \`v${{ steps.apk.outputs.version }}\`)" >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 2: Validar YAML**

Run: `bunx yaml-lint .github/workflows/mobile-android.yml`
Expected: `Ok` (sem erro de sintaxe). Se o `bunx yaml-lint` falhar em baixar (offline), validar manualmente: conferir indentação de 2 espaços, sem tabs, `on:`/`jobs:` no nível raiz.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/mobile-android.yml
git commit -m "ci: workflow de build Android (universal, assinado, upload na release)"
```

---

### Task 2: Verificação

Não há testes unitários — o próprio run do GitHub é a verificação. Rodar o workflow manualmente:

- [ ] **Step 1: Disparar o workflow**

Run: `gh workflow run mobile-android.yml`

Nota: exige `gh` autenticado com permissão `workflow` no repo. Se o `gh` local não estiver autenticado, o usuário dispara pela UI: **Actions → Mobile Android → Run workflow**.

- [ ] **Step 2: Acompanhar o run**

Run: `gh run watch`

Expected: os 14 steps verdes. Pontos de atenção se falhar:
- `bun tauri android build --apk` — erro de toolchain (NDK/JDK): conferir `NDK_HOME` e que `setup-android` instalou `platforms;android-36`.
- Assinatura — `apksigner` ausente: conferir `build-tools;36.0.0` na lista de pacotes.
- Upload — `release vX.Y.Z not found`: workflow desktop ainda não rodou no tag (wait-loop esgotou) ou, no dispatch, o `gh release create` falhou (checar `|| true`).

- [ ] **Step 3: Validar APK instalável**

Baixar o asset `ajudafinancas-<version>-android-universal.apk` da release e instalar no aparelho:

```bash
adb install -r ajudafinancas-<version>-android-universal.apk
```

Expected: `Success`. O app abre com o launcher. Como a keystore é cacheada, runs subsequentes mantêm a mesma assinatura e `-r` funciona direto (sem desinstalar).

---

## Self-Review

**1. Spec coverage:**
- Workflow separado + triggers `v*`/dispatch → Task 1 (`on:`).
- Toolchain completo (Rust targets 4, Java 17, SDK packages, NDK_HOME, Bun 1.3.14) → Task 1 steps.
- Build universal + assinatura debug keystore → Task 1.
- Cache da keystore (assinatura estável) → adicionado como melhoria sobre o spec; não contradiz (spec usava keystore gerada por run; cache é compatível com o objetivo "debug keystore sem secrets").
- Upload no release com wait-loop/dispatch-create → Task 1.
- Verificação (dispatch → run verde → adb install) → Task 2.
- iOS / keystore release / AAB → explicitamente fora (YAGNI), sem task.

**2. Placeholder scan:** Sem TBD/TODO; todo step tem conteúdo completo. Task 2 não tem código de teste (n/a — CI run é a verificação), mas o passo tem comando + expected + diagnóstico de falha.

**3. Type/name consistency:** `steps.apk.outputs.version` usado de forma idêntica no Prepare/Ensure/Upload/Summary. `ajudafinancas-<version>-android-universal.apk` nome consistente em Prepare, Upload e Task 2 Step 3. Caminho do unsigned APK idêntico ao spec (confirmado em AGENTS.md e no build local).
