# Ajuda Finanças

App desktop de finanças pessoais (Tauri v2 + Next.js + shadcn/ui + SQLite).

## Requisitos

- [rustup](https://rustup.rs) (stable) + componentes `clippy` e `rustfmt`
- [bun](https://bun.sh)
- Dependências de sistema (Arch):

```bash
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file xdotool openssl libayatana-appindicator librsvg xdg-utils
```

Outras distros: siga a [documentação de pré-requisitos do Tauri](https://tauri.app/start/prerequisites/).

## Desenvolvimento

```bash
bun install
bun run tauri dev
```

Testes e checagens:

```bash
cargo test --manifest-path src-tauri/Cargo.toml   # backend (Rust)
bun run typecheck                                  # tipos do frontend
bun run lint                                       # eslint
bun run build                                      # export estático do Next
```

## Build

```bash
bun run tauri build
```

Gera bundles em `src-tauri/target/release/bundle/` (AppImage, deb, rpm).

## Release / atualização automática

1. Configure a chave de assinatura do updater (uma vez):
   ```bash
   bunx tauri signer generate -w ~/.tauri/ajudafinancas.key
   ```
   Cole a pubkey em `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.

2. Adicione os secrets no repositório GitHub (`DevDanielCh/AjudaFinancasTauri`):
   - `TAURI_SIGNING_PRIVATE_KEY` — conteúdo do arquivo `.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — senha definida na geração

3. Crie uma tag `v*` e faça push:
   ```bash
   git tag v0.2.0 && git push origin v0.2.0
   ```
   O workflow `.github/workflows/release.yml` gera o release com assets e `latest.json`.
