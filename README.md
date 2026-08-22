# Ajuda Finanças

**Organizador de finanças pessoais com banco de dados 100% local.**
Tudo o que você registra fica no seu computador — sem servidor, sem cadastro, sem nuvem obrigatória.

```
Seus dados. Sua máquina. Ponto.
```

Ajuda Finanças é um app desktop e mobile para controlar receitas, despesas, contas fixas, parcelamentos, financiamentos e reserva de investimento. O banco de dados é um arquivo **SQLite dentro da sua máquina**: funciona offline, abre instantâneo e não depende de nenhum serviço externo para existir.

---

## Por que local-first?

A maioria dos apps de finanças exige conta, sincroniza tudo para a nuvem e usa seus dados como produto. O Ajuda Finanças faz o contrário:

- **Banco de dados local (SQLite)** — todas as transações vivem em um único arquivo no seu dispositivo.
- **Funciona 100% offline** — criar, editar e analisar dados não precisa de internet.
- **Nada sai da sua máquina por padrão** — sem telemetria, sem rastreamento, sem conta de usuário.
- **Backup opcional e criptografado** — se você quiser, sincronize com seu próprio Google Drive usando criptografia ponta a ponta com senha sua. Sem a senha, nem o app consegue ler o backup.
- **Você pode levar seus dados embora** — o arquivo do banco é seu; apague-o e nada sobra em lugar nenhum.

## Funcionalidades

### Visão geral
- **Dashboard mensal** com receitas, despesas, saldo, evolução ao longo dos meses, gastos por categoria e por forma de pagamento.
- **Meta de investimento** — defina uma % da renda e acompanhe se bateu a meta no mês.
- **Comparação com o mês anterior** direto no painel.

### Movimentações
- **Transações** com categorias, formas de pagamento, compra no cartão e anotações.
- **Contas fixas** que geram automaticamente as transações de cada mês.
- **Parcelamentos** — informe o valor e o número de parcelas; as transações são criadas mês a mês.
- **Financiamentos e empréstimos** com cálculo de tabela de amortização (entrada + parcelas mensais geradas automaticamente).
- **Reserva de investimento** — aportes e resgates com saldo acumulado.

### Organização
- **Múltiplas contas/carteiras** com cores próprias e troca rápida pelo rail lateral.
- **Categorias e formas de pagamento** personalizadas.
- **Faturas de cartão** agrupadas automaticamente por competência.
- **Navegação por mês** global — todo o app acompanha o mês selecionado.

### Experiência
- Interface em **português (Brasil)**.
- **Tema claro/escuro** seguindo o sistema.
- Atalhos de contexto: clique-direito (ou toque longo) nas contas para editar/excluir.
- **Atualização automática** no desktop, com pacotes assinados.

## Download

Baixe a versão mais recente na [página de releases](https://github.com/DevDanielCh/AjudaFinancasTauri/releases/latest):

| Plataforma | Formato |
|---|---|
| Windows | Instalador `.exe` (NSIS) |
| Linux | `.AppImage` e `.deb` |
| Android | `.apk` |

> **Linux/AppImage:** mantenha o AppImage em uma pasta do seu usuário (ex.: `~/Aplicativos`) para que o atualizador automático tenha permissão de escrita.

## Stack

| Camada | Tecnologia |
|---|---|
| Shell nativo | [Tauri v2](https://tauri.app) (Rust) |
| Frontend | Next.js + React + TypeScript |
| UI | Tailwind CSS v4 + componentes shadcn/ui sobre Base UI |
| Dados | SQLite (local), acesso via comandos Tauri em Rust |
| Estado | TanStack Query / Table / Charts |
| Backup | Google Drive (opcional, criptografado ponta a ponta) |

O frontend é exportado estaticamente (`next build`) e embutido no binário — nenhuma requisição de rede é necessária para usar o app.

---

## Desenvolvimento

### Requisitos

- [rustup](https://rustup.rs) (stable) + componentes `clippy` e `rustfmt`
- [bun](https://bun.sh)
- Dependências de sistema (Arch):

```bash
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file xdotool openssl libayatana-appindicator librsvg xdg-utils
```

Outras distros: siga a [documentação de pré-requisitos do Tauri](https://tauri.app/start/prerequisites/).

### Rodando

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

### Build

```bash
bun run tauri build
```

Gera bundles em `src-tauri/target/release/bundle/`. Em Arch, o bundler de AppImage (linuxdeploy antigo) falha com o glibc mais novo (erro de `strip`/`.relr.dyn`); use `--bundles deb,rpm` localmente. O AppImage e os artefatos assinados (`latest.json`) são gerados pelo CI (`.github/workflows/release.yml`, ubuntu-22.04).

## Licença

Distribuído sob a [Licença MIT](LICENSE).
