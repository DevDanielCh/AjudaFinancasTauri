# CI — Build Android no GitHub Actions

## Objetivo

Gerar APK Android assinado via GitHub Actions e publicar nos assets da release `v*`, para instalação no celular do dono (uso pessoal). Sem conta Apple paga e sem Mac, iOS fica fora do escopo — build iOS continuaria sendo só de verificação (unsigned) num runner macOS, sem valor prático. Fica para quando houver conta/necessidade.

## Decisões

- **Trigger**: `push` em tags `v*` + `workflow_dispatch` (espelha `release.yml`).
- **Workflow separado** `mobile-android.yml` (não estender `release.yml`): dispatch manual roda só Android, rápido, sem build desktop.
- **Assinatura**: debug keystore padrão do Android (pública, sem secrets). APK instala via adb no aparelho do dono, igual ao fluxo local. **Não publicável em loja** — quando publicar, migrar para keystore release como secret.
- **Arquitetura**: APK universal (todas ABIs: armv7/arm64/x86_64) — `tauri android build --apk` sem `--target` é universal por padrão.
- **Destino**: assets da release `v<version>` (mesma release criada pelo workflow desktop).

## Workflow

Arquivo: `.github/workflows/mobile-android.yml`

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
      - uses: actions/checkout@v4

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
          keytool -genkeypair -v \
            -keystore "$RUNNER_TEMP/debug.keystore" \
            -alias androiddebugkey -storepass android -keypass android \
            -keyalg RSA -keysize 2048 -validity 10000 \
            -dname "CN=Android Debug,O=Android,C=US"
          "$ANDROID_HOME/build-tools/36.0.0/apksigner" sign \
            --ks "$RUNNER_TEMP/debug.keystore" \
            --ks-key-alias androiddebugkey \
            --ks-pass pass:android --key-pass pass:android \
            --out "$RUNNER_TEMP/ajudafinancas-mobile.apk" \
            src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk

      - name: Compute APK path and version
        id: apk
        run: |
          echo "version=$(jq -r .version src-tauri/tauri.conf.json)" >> "$GITHUB_OUTPUT"
          echo "asset=ajudafinancas-$(jq -r .version src-tauri/tauri.conf.json)-android-universal.apk" >> "$GITHUB_OUTPUT"
          cp "$RUNNER_TEMP/ajudafinancas-mobile.apk" "$RUNNER_TEMP/ajudafinancas-$(jq -r .version src-tauri/tauri.conf.json)-android-universal.apk"

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
          gh release upload "$VERSION" "$RUNNER_TEMP/${{ steps.apk.outputs.asset }}" --clobber
```

### Observações

- **Nome do asset**: `gh release upload` não renomeia via flag — o APK é copiado para `ajudafinancas-<version>-android-universal.apk` no step "Compute" antes do upload.
- **Race do release**: workflow desktop cria o release via `tauri-action` no mesmo push de tag. O job Android espera com wait-loop (`gh release view` a cada 15s, máx 40 tentativas ≈ 10min). Se o loop esgotar (desktop falhou), o upload falha e o job termina vermelho com erro visível — sem loop infinito. No dispatch manual, ninguém cria o release → job cria com `gh release create --draft` (idempotente, `|| true`).
- `tauri.settings.gradle` (gen/android, gitignored) aponta para o registry cargo local; o `tauri-cli` regenera no CI com os caminhos do runner. Sem ação necessária.
- `beforeBuildCommand` (`bun run build`) roda automaticamente no `tauri android build`.
- Frontend output: `../out` (frontendDist), independente do runner.

## Fora de escopo (YAGNI)

- iOS (unsigned/simulator): sem valor sem Mac/conta paga para instalar.
- Keystore release / assinatura Play Store / AAB: só quando publicar em loja.
- TestFlight, notarização, uploads de loja.
- Builds por ABI em paralelo: universal basta para uso pessoal.

## Verificação

- **CI**: rodar `workflow_dispatch` → job completo termina verde, release `v<version>` (draft) criada com o asset `ajudafinancas-<version>-android-universal.apk`.
- **Local**: baixar o APK do release e `adb install -r` no aparelho → app abre.
- Checagem de sanity do YAML: `actionlint` ou revisão visual; validação real é o próprio run do GitHub.
