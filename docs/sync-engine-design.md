# ETAPA 2 — DESIGN: Sync Engine via Google Drive

## Índice

1. [Resumo das Decisões](#1-resumo-das-decisões)
2. [Schema SQLite — Migração](#2-sqlite--migração)
3. [Google Drive — Estrutura de Arquivos](#3-google-drive--estrutura-de-arquivos)
4. [Formato dos Dados no Drive](#4-formato-dados-drive)
5. [Protocolo de Sincronização](#5-protocolo-sync)
6. [Conflitos — Último Write Wins](#6-conflitos)
7. [Exclusões — Tombstones](#7-exclusões)
8. [Primeira Sincronização](#8-primeira-sync)
9. [Criptografia Ponta-a-Ponta](#9-criptografia)
10. [Google OAuth2 — Fluxo](#10-google-oauth)
11. [DriveProvider — Abstração](#11-drive-provider)
12. [Recuperação de Dados](#12-recuperação)
13. [Snapshots / Backup](#13-snapshots)
14. [Arquitetura de Módulos](#14-módulos)
15. [Dependências Rust](#15-dependências)
16. [O que NÃO será sincronizado](#16-nao-sincronizado)
17. [Arquivos a Criar e Alterar](#17-arquivos)
18. [Riscos e Mitigações](#18-riscos)

---

## 1. Resumo das Decisões

| Questão | Decisão |
|---|---|
| IDs | Adicionar coluna `uuid TEXT` (UUID v4) a todas entidades. ID INTEGER LOCAL mantido como alias. |
| Dados derivados | Faturas (type=3), parcelas de fixed_bills e loans NÃO sincronizam. Regenerados localmente. |
| Settings | Sincronizam. |
| Criptografia | XChaCha20-Poly1305 com chave derivada de passphrase do usuário (Argon2id). |
| Conflitos | Último write wins (op_timestamp). |
| OAuth Client ID | Usuário fornece depois. |
| Storage Drive | `appDataFolder` (privado, específico do app). |

---

## 2. SQLite — Migração

### 2.1 Novas colunas em entidades existentes

Cada tabela sincronizável recebe:

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `uuid` | TEXT | NULL (NOT NULL após migração) | UUID v4, identificador global único |
| `created_at` | TEXT | `datetime('now')` | ISO 8601 UTC |
| `updated_at` | TEXT | `datetime('now')` | ISO 8601 UTC — usado para last-write-wins |
| `deleted_at` | TEXT | NULL | Soft delete (tombstone) |

**Tabelas afetadas:**

```sql
-- payment_methods
ALTER TABLE payment_methods ADD COLUMN uuid TEXT;
ALTER TABLE payment_methods ADD COLUMN created_at TEXT;
ALTER TABLE payment_methods ADD COLUMN updated_at TEXT;
ALTER TABLE payment_methods ADD COLUMN deleted_at TEXT;

-- categories
ALTER TABLE categories ADD COLUMN uuid TEXT;
ALTER TABLE categories ADD COLUMN created_at TEXT;
ALTER TABLE categories ADD COLUMN updated_at TEXT;
ALTER TABLE categories ADD COLUMN deleted_at TEXT;

-- fixed_bills
ALTER TABLE fixed_bills ADD COLUMN uuid TEXT;
ALTER TABLE fixed_bills ADD COLUMN created_at TEXT;
ALTER TABLE fixed_bills ADD COLUMN updated_at TEXT;
ALTER TABLE fixed_bills ADD COLUMN deleted_at TEXT;

-- loans
ALTER TABLE loans ADD COLUMN uuid TEXT;
ALTER TABLE loans ADD COLUMN created_at TEXT;
ALTER TABLE loans ADD COLUMN updated_at TEXT;
ALTER TABLE loans ADD COLUMN deleted_at TEXT;

-- transactions (APENAS transações manuais; derivadas não precisam)
ALTER TABLE transactions ADD COLUMN uuid TEXT;
ALTER TABLE transactions ADD COLUMN created_at TEXT;
ALTER TABLE transactions ADD COLUMN updated_at TEXT;
ALTER TABLE transactions ADD COLUMN deleted_at TEXT;

-- settings
ALTER TABLE settings ADD COLUMN uuid TEXT;
ALTER TABLE settings ADD COLUMN created_at TEXT;
ALTER TABLE settings ADD COLUMN updated_at TEXT;
ALTER TABLE settings ADD COLUMN deleted_at TEXT;
```

**População de uuid para dados existentes:** feita em Rust via `uuid::Uuid::new_v4()` após a migration SQL, dentro de uma transação.

### 2.2 Triggers — Auto-preenchimento

```sql
-- INSERT: preenche uuid, created_at, updated_at se ausentes
CREATE TRIGGER trg_payment_methods_insert
AFTER INSERT ON payment_methods
WHEN NEW.uuid IS NULL
BEGIN
  UPDATE payment_methods
  SET uuid = lower(hex(randomblob(16))),
      created_at = datetime('now'),
      updated_at = datetime('now')
  WHERE rowid = NEW.rowid;
END;

-- INSERT: preserva timestamps vindos do sync
CREATE TRIGGER trg_payment_methods_insert_sync
AFTER INSERT ON payment_methods
WHEN NEW.uuid IS NOT NULL AND NEW.created_at IS NULL
BEGIN
  UPDATE payment_methods
  SET created_at = datetime('now'),
      updated_at = datetime('now')
  WHERE rowid = NEW.rowid;
END;

-- UPDATE: sempre atualiza updated_at (exceto durante sync)
CREATE TRIGGER trg_payment_methods_update
AFTER UPDATE ON payment_methods
WHEN WHEN iif(prAGMA('sync_session') = '1', 0, 1)
BEGIN
  UPDATE payment_methods
  SET updated_at = datetime('now')
  WHERE rowid = NEW.rowid;
END;
```

> **Nota:** Os triggers acima são ilustrativos. A implementação real usa `WHEN coalesce(ieee754_ ... )` ou function custom porque `PRAGMA` não é diretamente acessível em triggers.
> **Solução real:** usar `SELECT` de uma tabela auxiliar `_sync_config(key, value)` com chave `session`, ou usar `sqlite3_set_auxdata` via Rust function注册.
> **Decisão final:** usar tabela auxiliar `_sync_config` com um registro `('session', '0')`. Triggers leem essa tabela. Sync engine altera para `'1'` antes de aplicar remote ops.

```sql
-- Tabela auxiliar para flag de sessão de sync
CREATE TABLE IF NOT EXISTS _sync_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO _sync_config (key, value) VALUES ('session', '0');
```

### 2.3 Tabelas de Sincronização

```sql
-- Log de operações (append-only)
CREATE TABLE sync_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  entity TEXT NOT NULL,          -- 'payment_methods', 'categories', etc.
  entity_uuid TEXT NOT NULL,     -- uuid da entidade afetada
  operation TEXT NOT NULL,       -- 'INSERT', 'UPDATE', 'DELETE'
  payload TEXT NOT NULL,         -- JSON: estado completo do registro
  op_timestamp TEXT NOT NULL,   -- ISO 8601 UTC, monotônico por dispositivo
  version INTEGER NOT NULL,     -- contador global, atribuído ao inserir
  synced_at TEXT                 -- NULL = não sincronizado ainda
);
CREATE INDEX idx_sync_ops_version ON sync_operations(version);
CREATE INDEX idx_sync_ops_entity_uuid ON sync_operations(entity, entity_uuid);
CREATE INDEX idx_sync_ops_synced ON sync_operations(synced_at);

-- Estado de sincronização por dispositivo
CREATE TABLE sync_state (
  device_id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL,     -- UUID do "banco" (mesmos devices = mesmo DB)
  last_sync_version INTEGER NOT NULL DEFAULT 0,
  last_sync_at TEXT,
  device_name TEXT
);

-- Dispositivos registrados
CREATE TABLE device_registry (
  device_id TEXT PRIMARY KEY,
  device_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  platform TEXT NOT NULL         -- 'linux', 'windows', 'macos', 'android', 'ios'
);
```

### 2.4 Versão Global (counter)

O `version` em `sync_operations` é um contador global monotonamente crescente. Atribuído quando a operação é inserida no log (push local). Usa tabela auxiliar:

```sql
CREATE TABLE IF NOT EXISTS _sync_counter (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO _sync_counter (key, value) VALUES ('current', 0);
```

Função para obter próximo version:

```sql
-- Em Rust:
BEGIN IMMEDIATE;
UPDATE _sync_counter SET value = value + 1 WHERE key = 'current';
SELECT value FROM _sync_counter WHERE key = 'current';
-- Usar o valor retornado como version da operação
COMMIT;
```

---

## 3. Google Drive — Estrutura de Arquivos

```
appDataFolder/
├── ayudafinancas/
│   ├── manifest.json              -- metadata do database
│   ├── operations/
│   │   ├── ops_000001.json.gz.enc -- operações 1-1000, criptografadas
│   │   ├── ops_0001001.json.gz.enc -- operações 1001-2000
│   │   └── ...
│   └── snapshots/
│       ├── snap_2026-08-17.json.gz.enc -- snapshot periódico
│       └── ...
```

**Nomes de arquivos no Drive:**
- Manifest: `{database_id}/manifest.json`
- Operações: `{database_id}/operations/ops_{start_version}.json.gz.enc`
- Snapshots: `{database_id}/snapshots/snap_{date}.json.gz.enc`

**Versionamento de operações no Drive:**
- Operações locais não sincronizadas são escritas em arquivos novos
- Cada arquivo contém um lote de operações (max 1000 por arquivo)
- Arquivos são appendados (não modificados) durante push
- Pull lê apenas arquivos com version > last_sync_version

---

## 4. Formato dos Dados no Drive

### 4.1 manifest.json

```json
{
  "database_id": "uuid-v4-do-database",
  "schema_version": 9,
  "created_at": "2026-08-17T10:00:00Z",
  "encryption": {
    "enabled": true,
    "algorithm": "xchacha20-poly1305",
    "kdf": "argon2id",
    "encrypted_dek": "base64-do-dek-criptografado-pela-passphrase"
  },
  "devices": [
    {
      "device_id": "uuid-do-device-a",
      "device_name": "Desktop-Daniel",
      "platform": "linux",
      "last_sync_version": 42,
      "last_sync_at": "2026-08-17T10:30:00Z"
    }
  ],
  "latest_version": 42,
  "snapshot_count": 1
}
```

### 4.2 Arquivo de operações (antes de criptografar)

```json
{
  "database_id": "uuid-do-database",
  "start_version": 1,
  "end_version": 42,
  "operations": [
    {
      "id": 1,
      "device_id": "uuid-device-a",
      "entity": "categories",
      "entity_uuid": "uuid-da-categoria",
      "operation": "INSERT",
      "payload": {
        "uuid": "uuid-da-categoria",
        "name": "Alimentação",
        "type": 2,
        "color": "#ef4444",
        "icon": "utensils",
        "created_at": "2026-08-17T10:00:00Z",
        "updated_at": "2026-08-17T10:00:00Z",
        "deleted_at": null
      },
      "op_timestamp": "2026-08-17T10:00:00Z",
      "version": 1
    },
    {
      "id": 42,
      "device_id": "uuid-device-b",
      "entity": "transactions",
      "entity_uuid": "uuid-da-transacao",
      "operation": "UPDATE",
      "payload": {
        "uuid": "uuid-da-transacao",
        "description": "Supermercado",
        "amount": 15000,
        "type": 2,
        "date": "2026-08-15",
        "category_uuid": "uuid-da-categoria",
        "payment_method_uuid": "uuid-do-pm",
        "fixed_bill_uuid": null,
        "loan_uuid": null,
        "bill_start": null,
        "bill_end": null,
        "card_mode": 0,
        "created_at": "2026-08-17T10:00:00Z",
        "updated_at": "2026-08-17T11:00:00Z",
        "deleted_at": null
      },
      "op_timestamp": "2026-08-17T11:00:00Z",
      "version": 42
    }
  ]
}
```

### 4.3 Payload — Referências FK como UUIDs

No payload, foreign keys são representadas como UUIDs (não IDs locais):

```json
{
  "uuid": "uuid-da-transacao",
  "category_uuid": "uuid-da-categoria",     // não category_id
  "payment_method_uuid": "uuid-do-pm",      // não payment_method_id
  "fixed_bill_uuid": null,                   // não fixed_bill_id
  "loan_uuid": null                          // não loan_id
}
```

Durante **apply**, o engine resolve UUID → ID local:

```rust
fn resolve_local_id(conn: &Connection, entity: &str, uuid: &str) -> Option<i64> {
    // SELECT id FROM {entity} WHERE uuid = ? AND deleted_at IS NULL
}
```

---

## 5. Protocolo de Sincronização

### 5.1 Ciclo completo

```
┌─────────────────────────────────────────────────────┐
│                    SYNC ENGINE                       │
│                                                      │
│  1. FETCH (sem lock no DB)                           │
│     ├── Ler manifest do Drive                        │
│     ├── Identificar operações remotas não vistas     │
│     └── Download dos arquivos de operações            │
│                                                      │
│  2. APPLY (com lock no DB, curto)                    │
│     ├── PRAGMA sync_session = 1                      │
│     ├── Para cada operação remota:                   │
│     │   ├── Resolver FKs (UUID → local ID)           │
│     │   ├── INSERT/UPDATE/DELETE na tabela            │
│     │   └── Atualizar sync_state                     │
│     ├── PRAGMA sync_session = 0                      │
│     └── COMMIT                                       │
│                                                      │
│  3. COLLECT (com lock no DB, curto)                  │
│     ├── Ler operações locais com synced_at IS NULL   │
│     └── Serializar como payload                      │
│                                                      │
│  4. PUSH (sem lock no DB)                            │
│     ├── Criptografar payload                         │
│     ├── Upload para Drive                            │
│     └── Marcar synced_at nas operações enviadas      │
│                                                      │
│  5. STATUS                                           │
│     └── Atualizar sync_status (frontend)             │
└─────────────────────────────────────────────────────┘
```

### 5.2 Condições de execução

| Condição | Comportamento |
|---|---|
| Offline | Apenas operações locais. Push e pull adiados. |
| Internet, sem Google conectado | Apenas operações locais. |
| Internet, Google conectado | Pull + Push. |
| Drive indisponível | Erro no status. Operações locais continuam. |
| Token expirado | Refresh automático. Se falhar, erro + retry. |

### 5.3 Sync automático

- **Pull:** A cada 5 minutos (se internet disponível)
- **Push:** 3 segundos após última mutation local (debounce)
- **Manual:** Botão "Sincronizar agora"

### 5.4 Idempotência

Operações são idempotentes porque:

1. **INSERT com UUID existente:** verificação `WHERE uuid = ?` antes de insert → no-op
2. **UPDATE:** `SET ... WHERE uuid = ?` → resultado sempre o mesmo
3. **DELETE:** `SET deleted_at = datetime('now') WHERE uuid = ? AND deleted_at IS NULL` → no-op se já deletado
4. **Version:** operações com `version <= last_sync_version` são ignoradas

---

## 6. Conflitos — Último Write Wins

### 6.1 Mecanismo

Cada operação carrega `op_timestamp` (ISO 8601 UTC do dispositivo de origem).

Conflito ocorre quando:
- Dispositivo A e B modificam a mesma entidade (mesmo `entity_uuid`)
- Ambos ficam offline
- Ambos sincronizam

**Resolução:** `op_timestamp` mais recente vence.

### 6.2 Aplicação

```rust
fn apply_update(conn: &Connection, entity: &str, uuid: &str, payload: &str, op_ts: &str) {
    // Verificar se registro local existe
    let local: Option<(i64, String)> = conn.query_row(
        &format!("SELECT id, updated_at FROM {entity} WHERE uuid = ? AND deleted_at IS NULL"),
        params![uuid],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).optional()?;

    match local {
        None => {
            // Registro não existe localmente → INSERT
            insert_from_payload(conn, entity, payload);
        }
        Some((id, local_updated_at)) => {
            if op_ts > local_updated_at {
                // Remoto é mais recente → UPDATE
                update_from_payload(conn, entity, id, payload, op_ts);
            }
            // Senão → local é mais recente, ignorar
        }
    }
}
```

### 6.3 Exemplo

```
Desktop:  update transaction X, amount = 100, op_ts = T+0
Mobile:   update transaction X, amount = 150, op_ts = T+5min

Sync Desktop (pull mobile):
  op_ts mobile (T+5min) > local updated_at (T+0) → aplicar amount=150 ✓

Sync Mobile (pull desktop):
  op_ts desktop (T+0) < local updated_at (T+5min) → ignorar ✓

Ambos convergem para amount=150 ✓
```

### 6.4 Casos especiais

| Cenário | Comportamento |
|---|---|
| Mesmo timestamp (raro) | UUID do device como tiebreaker (lexicográfico) |
| Create vs Update | Create sempre vence (se registro não existe) |
| Delete vs Update | Delete com timestamp mais recente vence |
| Delete vs Delete | Ambos setam deleted_at → idempotente |

---

## 7. Exclusões — Tombstones

### 7.1 Soft delete

Nunca DELETE físico durante sync. Usar:

```sql
UPDATE {entity} SET deleted_at = datetime('now') WHERE uuid = ?;
```

### 7.2 Propagação

1. Desktop deleta categoria X → `deleted_at = T1`
2. Sync: operação DELETE propagada para o Drive
3. Mobile faz pull → `UPDATE categories SET deleted_at = T1 WHERE uuid = 'X'`
4. Transactions com `category_uuid = X` ficam com `category_id = NULL` (via `ON DELETE SET NULL` existente)

### 7.3 Visibilidade

Queries existentes precisam filtrar `deleted_at IS NULL`:

```sql
-- Exemplo: listing categories
SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY name;
```

**Impacto:** Todas queries de listagem no `repository.rs` precisam de `AND deleted_at IS NULL`.

### 7.4 Garbage collection

Tombstones com mais de 90 dias podem ser removidos fisicamente:

```sql
DELETE FROM {entity} WHERE deleted_at IS NOT NULL
  AND deleted_at < datetime('now', '-90 days');
```

Executado periodicamente (ex.: uma vez por mês).

### 7.5 Exclusões derivadas

Quando um `fixed_bill` ou `loan` é deletado:
- As transactions derivadas (`fixed_bill_id`/`loan_id` referenciando) também são deletadas localmente
- A exclusão do fixed_bill/loan é sincronizada
- O outro dispositivo aplica a exclusão e regera as transactions derivadas localmente

---

## 8. Primeira Sincronização

### 8.1 Cenário A: Dispositivo com dados locais, conecta Google pela primeira vez

```
1. Usuário clica "Conectar Google"
2. OAuth flow → obter tokens
3. Gerar database_id (UUID v4) se não existe
4. Criar device_id (UUID v4) para este dispositivo
5. Manifest não existe no Drive → este é o primeiro dispositivo
6. UPLOAD: serializar todas entidades como operações INSERT
7. Criar manifest.json no Drive
8. Registrar device em sync_state
```

### 8.2 Cenário B: Dispositivo vazio, conecta Google com dados existentes no Drive

```
1. Usuário clica "Conectar Google"
2. OAuth flow → obter tokens
3. Manifest existe no Drive → dados já existem
4. DOWNLOAD: baixar snapshot + operações
5. Aplicar localmente (INSERT com UUIDs preservados)
6. Gerar derived transactions localmente (fixed_bills, loans, card_bills)
7. Registrar device em sync_state
```

### 8.3 Cenário C: Dados locais E dados remotos diferentes

```
1. Usuário clica "Conectar Google"
2. OAuth flow → obter tokens
3. Manifest existe no Drive
4. Download remoto → comparar com local
5. APRESENTAR AO USUÁRIO:
   ┌──────────────────────────────────────────────────┐
   │  Dados encontrados em ambos os dispositivos.     │
   │                                                   │
   │  Dispositivo local: 15 categorias, 120 transações │
   │  Google Drive:      8 categorias, 85 transações   │
   │                                                   │
   │  [Usar dados locais]                              │
   │  [Usar dados do Google Drive]                     │
   │  [Merge manual]                                   │
   └──────────────────────────────────────────────────┘
6a. "Usar dados locais":
    → Upload de todos registros locais como INSERT
    → Registros remotos com UUIDs diferentes = duplicatas (usuário limpa depois)
    → Registros com mesmo UUID = merge (último write wins)

6b. "Usar dados do Google Drive":
    → Download e aplicar remote ops
    → Dados locais com UUIDs diferentes = descartados (soft deleted)
    → Registros com mesmo UUID = merge (último write wins)

6c. "Merge manual":
    → UI lista entidades conflitantes
    → Usuário escolhe qual versão para cada uma
```

---

## 9. Criptografia Ponta-a-Ponta

### 9.1 Arquitetura

```
┌─────────────────────────────────────────┐
│ Passphrase do usuário                   │
│         ↓                               │
│ Argon2id(passphrase, salt) → Key (32B)  │
│         ↓                               │
│ HKDF(Key, "dek-encryption") → EncKey    │
│         ↓                               │
│ Random DEK (32 bytes)                   │
│         ↓                               │
│ XChaCha20-Poly1305(DEK) → dados        │
│         ↓                               │
│ DEK criptografado com EncKey → manifest │
└─────────────────────────────────────────┘
```

### 9.2 Chave de criptografia (DEK)

- **DEK (Data Encryption Key):** chave aleatória de 32 bytes gerada uma vez
- **EncKey:** derivada da passphrase via Argon2id + HKDF
- **DEK criptografado:** salvo no `manifest.json` (campo `encrypted_dek`)
- Cada dispositivo: `decrypt(encrypted_dek, EncKey)` → obtém DEK → decripta dados

### 9.3 Fluxo por dispositivo

**Primeiro dispositivo:**
1. Usuário define passphrase
2. Derivar EncKey da passphrase
3. Gerar DEK aleatório
4. Criptografar DEK com EncKey → salvar no manifest
5. Usar DEK para criptografar todos os dados

**Dispositivos seguintes:**
1. Usuário entra com a mesma passphrase
2. Derivar EncKey da passphrase
3. Decriptar DEK do manifest
4. Usar DEK para decriptar/criptografar dados

### 9.4 Alteração de passphrase

1. Decriptar DEK com EncKey antigo
2. Derivar nova EncKey com nova passphrase
3. Re-criptografar DEK com nova EncKey
4. Atualizar manifest
5. Todos dispositivos precisam da nova passphrase no próximo sync

### 9.5 Libs Rust

```toml
chacha20poly1305 = "0.10"    # XChaCha20-Poly1305
argon2 = "0.5"               # Argon2id KDF
hkdf = "0.12"                # HKDF para derivação
rand = "0.8"                 # Gerador de DEK aleatório
```

### 9.6 Compressão

Antes de criptografar, comprimir com gzip:

```
dados JSON → gzip compress → XChaCha20-Poly1305 encrypt → arquivo .json.gz.enc
```

---

## 10. Google OAuth2 — Fluxo

### 10.1 Escopo mínimo

```
https://www.googleapis.com/auth/drive.appdata
```

Apenas acesso a `appDataFolder`. Não solicita acesso ao Drive completo.

### 10.2 Flow — Authorization Code + PKCE

```
1. App gera code_verifier (43-128 chars aleatórios)
2. App gera code_challenge = BASE64URL(SHA256(code_verifier))
3. App abre navegador:
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id={CLIENT_ID}&
     redirect_uri=http://127.0.0.1:{PORT}/callback&
     response_type=code&
     scope=drive.appdata&
     code_challenge={CHALLENGE}&
     code_challenge_method=S256
4. Usuário autoriza
5. Google redireciona para http://127.0.0.1:{PORT}/callback?code=XXXX
6. App captura o code via mini HTTP server
7. App troca code por tokens:
   POST https://oauth2.googleapis.com/token
   {
     code: XXXX,
     client_id: CLIENT_ID,
     code_verifier: VERIFIER,
     grant_type: authorization_code,
     redirect_uri: http://127.0.0.1:{PORT}/callback
   }
8. Resposta:
   {
     access_token: "ya29...",
     refresh_token: "1//0g...",
     expires_in: 3600,
     token_type: "Bearer"
   }
9. Salvar refresh_token no OS keychain (keyring crate)
10. Salvar access_token em memória (temporário)
```

### 10.3 Refresh automático

```rust
// Antes de cada operação no Drive:
if access_token.expired() {
    let new_token = refresh_token(refresh_token, client_id, client_secret);
    // Atualizar em memória
}
```

### 10.4 Armazenamento seguro

```rust
// keyring crate — usa OS keychain nativo
use keyring::Entry;

fn store_credentials(refresh_token: &str, access_token: &str) {
    let entry = Entry::new("ajudafinancas", "google-sync").unwrap();
    entry.set_password(refresh_token).unwrap();
}

fn load_refresh_token() -> Option<String> {
    let entry = Entry::new("ajudafinancas", "google-sync").ok()?;
    entry.get_password().ok()
}
```

### 10.5 Mini HTTP server para callback

```rust
// Tauri: criar servidor HTTP temporário na porta aleatória
// Usar hyper ou axum leve
// Escutar em http://127.0.0.1:{port}/callback
// Capturar ?code=XXXX e retornar página HTML "Pode fechar"
```

---

## 11. DriveProvider — Abstração

### 11.1 Trait

```rust
#[async_trait]
pub trait DriveProvider: Send + Sync {
    /// Autenticar (abrir navegador, obter tokens)
    async fn authenticate(&mut self) -> Result<(), SyncError>;

    /// Verificar se está autenticado
    async fn is_authenticated(&self) -> bool;

    /// Upload de arquivo para appDataFolder
    async fn upload(
        &self,
        path: &str,           // caminho relativo dentro de appDataFolder
        data: &[u8],          // dados criptografados
        mime_type: &str,
    ) -> Result<(), SyncError>;

    /// Download de arquivo de appDataFolder
    async fn download(&self, path: &str) -> Result<Vec<u8>, SyncError>;

    /// Verificar se arquivo existe
    async fn exists(&self, path: &str) -> Result<bool, SyncError>;

    /// Deletar arquivo
    async fn delete(&self, path: &str) -> Result<(), SyncError>;

    /// Listar arquivos em diretório
    async fn list(&self, prefix: &str) -> Result<Vec<FileInfo>, SyncError>;

    /// Obter metadata de arquivo (tamanho, modified_time)
    async fn metadata(&self, path: &str) -> Result<FileInfo, SyncError>;

    /// Desconectar (limpar tokens)
    async fn disconnect(&mut self) -> Result<(), SyncError>;
}

#[derive(Debug, Clone)]
pub struct FileInfo {
    pub name: String,
    pub size: u64,
    pub modified_time: String,
}
```

### 11.2 Implementações

- `GoogleDriveProvider` — implementação inicial
- `LocalFolderProvider` — para testes e backup local
- Futuro: `OneDriveProvider`, `DropboxProvider`

---

## 12. Recuperação de Dados

### 12.1 Cenários

| Cenário | Recuperação |
|---|---|
| SQLite apagado | Download snapshot + operations do Drive → reconstruir |
| Computador formatado | Mesmo fluxo acima |
| App reinstalado | Primeira sync: dados no Drive → download |
| Dispositivo perdido | Novo dispositivo: connect Google → download |
| Drive corrompido | Dados locais continuam funcionando; re-upload |

### 12.2 Fluxo de recuperação

```
1. Instalação limpa
2. Usuário conecta Google
3. Manifest encontrado no Drive
4. Download snapshot.json.gz.enc
5. Decriptar com DEK
6. Descomprimir
7. Aplicar todos registros via INSERT (UUIDs preservados)
8. Gerar derived transactions localmente
9. Baixar operações incrementais desde o snapshot
10. Aplicar
11. Device registrado em sync_state
12. Dados 100% restaurados
```

---

## 13. Snapshots / Backup

### 13.1 Quando criar snapshot

- A cada 100 operações incrementais
- Uma vez por mês (se houver atividade)
- Manualmente (botão "Criar backup")

### 13.2 Formato do snapshot

```json
{
  "database_id": "uuid",
  "created_at": "2026-08-17T10:00:00Z",
  "version": 42,
  "data": {
    "payment_methods": [
      {"uuid": "...", "name": "PIX", "type": 1, ...}
    ],
    "categories": [...],
    "fixed_bills": [...],
    "loans": [...],
    "transactions": [...],  // APENAS manuais
    "settings": [...]
  }
}
```

### 13.3 Limpeza de snapshots antigos

Manter apenas:
- Último snapshot
- Snapshot de 30+ dias atrás (para restore point)

Deletar snapshots intermediários do Drive.

---

## 14. Arquitetura de Módulos

### 14.1 Rust — Módulos novos

```
src-tauri/src/
├── sync/
│   ├── mod.rs              # Re-exports
│   ├── engine.rs           # SyncEngine: push, pull, status
│   ├── operations.rs       # SyncOperation, ChangeSet, log helpers
│   ├── conflict.rs         # ConflictResolver (last-write-wins)
│   ├── device.rs           # DeviceId management
│   ├── provider.rs         # trait DriveProvider + FileInfo
│   ├── controller.rs       # #[tauri::command] handlers
│   ├── payload.rs          # Serialização/deserialização de payloads
│   └── trigger.sql         # SQL dos triggers (incluído via include_str!)
├── google/
│   ├── mod.rs
│   ├── auth.rs             # OAuth2 PKCE flow
│   ├── drive.rs            # GoogleDriveProvider impl
│   ├── credential.rs       # keyring storage
│   └── http_server.rs      # Mini server para callback
```

### 14.2 Arquivos a alterar

```
src-tauri/Cargo.toml            — novas dependências
src-tauri/src/lib.rs             — adicionar sync plugin + commands
src-tauri/src/db.rs              — adicionar migration 009
src-tauri/capabilities/default.json — novas permissões
migrations/009_sync.sql          — novas tabelas + colunas + triggers
```

### 14.3 Frontend — Arquivos novos

```
src/
├── shared/
│   ├── sync-repository.ts    # invoke para sync commands
│   ├── sync-services.ts      # hooks: useSync, useSyncStatus
│   └── sync-models.ts        # SyncStatus, GoogleAuthStatus types
├── Sync/
│   ├── SyncStatus.tsx         # Indicador visual de status
│   ├── SyncSettings.tsx       # Painel de configuração sync
│   └── GoogleConnect.tsx      # Botão "Conectar Google"
```

### 14.4 Integração com código existente

**O que muda no código existente:**

1. **`service.rs` (organizacao_financeira):** Adicionar `updated_at = datetime('now')` em todos UPDATE
2. **`repository.rs`:** Adicionar `AND deleted_at IS NULL` em queries de listagem
3. **`service.rs` — deletes:** Mudar `DELETE` para `UPDATE SET deleted_at = datetime('now')`
4. **`db.rs`:** Adicionar migration 009 + triggers
5. **`lib.rs`:** Adicionar sync commands ao `invoke_handler`

**O que NÃO muda:**
- Lógica de negócio (categorias, transações, empréstimos)
- Geração de faturas, parcelas
- Frontend existente (exceto configurações)

---

## 15. Dependências Rust

```toml
[dependencies]
# Sync engine
uuid = { version = "1", features = ["v4"] }
serde = { version = "1", features = ["derive"] }        # já existe
serde_json = "1"                                          # já existe
chrono = { version = "0.4.45", features = ["serde"] }   # já existe
rusqlite = { version = "0.40.1", features = ["bundled"] } # já existe

# HTTP + OAuth
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
base64 = "0.22"

# Criptografia
chacha20poly1305 = "0.10"
argon2 = "0.5"
hkdf = "0.12"
rand = "0.8"

# Armazenamento seguro
keyring = { version = "3", features = ["apple-native", "secret-service", "windows-native"] }

# Async
tokio = { version = "1", features = ["sync", "time", "net", "io-util"] }

# Compressão
flate2 = "1"
```

---

## 16. O que NÃO será sincronizado

| Dado | Motivo |
|---|---|
| `transactions` com `bill_start IS NOT NULL` (faturas type=3) | Auto-geradas por `refresh_card_bills()`. Regeneradas localmente. |
| `transactions` com `fixed_bill_id IS NOT NULL` | Auto-geradas por `generate_fixed_bills()`. Regeneradas localmente. |
| `transactions` com `loan_id IS NOT NULL AND type = 2` | Parcelas auto-geradas. Regeneradas localmente. |
| `_sync_config` | Auxiliar local. |
| `_sync_counter` | Auxiliar local. |
| `sync_state` | Local por dispositivo. |
| `device_registry` | Local por dispositivo. |

**Regra de filtragem para sync:**

```sql
-- SELECT para operações de sync (transactions)
SELECT * FROM transactions
WHERE bill_start IS NULL
  AND fixed_bill_id IS NULL
  AND (loan_id IS NULL OR type != 2)
  AND deleted_at IS NULL;
```

**Derived transactions são regeneradas localmente após cada pull:**

```rust
fn post_sync_regenerate(conn: &Connection) {
    // 1. Regenerar fixed_bills transactions
    let min_month = earliest_month(conn)?;
    let mut m = parse_month(&min_month)?;
    let now = Local::now().date_naive();
    while m <= now {
        generate_fixed_bills(conn, m)?;
        m = m.checked_add_months(Months::new(1)).unwrap();
    }

    // 2. Regenerar loan installments
    let now = Local::now().date_naive();
    let mut m = parse_month(&min_month)?;
    while m <= now {
        generate_loan_installments(conn, m)?;
        m = m.checked_add_months(Months::new(1)).unwrap();
    }

    // 3. Regenerar card bills
    refresh_card_bills(conn)?;
}
```

---

## 17. Arquivos a Criar e Alterar

### 17.1 Criar

| Arquivo | Descrição |
|---|---|
| `migrations/009_sync.sql` | Schema de sync (colunas, tabelas, triggers) |
| `src-tauri/src/sync/mod.rs` | Module sync |
| `src-tauri/src/sync/engine.rs` | Core sync logic |
| `src-tauri/src/sync/operations.rs` | Operation log helpers |
| `src-tauri/src/sync/conflict.rs` | Conflict resolution |
| `src-tauri/src/sync/device.rs` | Device management |
| `src-tauri/src/sync/provider.rs` | DriveProvider trait |
| `src-tauri/src/sync/controller.rs` | Tauri commands |
| `src-tauri/src/sync/payload.rs` | Payload serialization |
| `src-tauri/src/google/mod.rs` | Module google |
| `src-tauri/src/google/auth.rs` | OAuth2 PKCE |
| `src-tauri/src/google/drive.rs` | GoogleDriveProvider |
| `src-tauri/src/google/credential.rs` | keyring storage |
| `src-tauri/src/google/http_server.rs` | Callback server |
| `src/shared/sync-repository.ts` | Frontend sync API |
| `src/shared/sync-services.ts` | Frontend sync hooks |
| `src/shared/sync-models.ts` | Frontend sync types |
| `src/Sync/SyncStatus.tsx` | Status indicator |
| `src/Sync/SyncSettings.tsx` | Settings panel |
| `src/Sync/GoogleConnect.tsx` | Connect button |

### 17.2 Alterar

| Arquivo | Mudança |
|---|---|
| `src-tauri/Cargo.toml` | Novas dependências |
| `src-tauri/src/lib.rs` | Adicionar sync commands + optional SyncEngine |
| `src-tauri/src/db.rs` | Adicionar migration 009, populate_uuids |
| `src-tauri/capabilities/default.json` | Novas permissões |
| `src-tauri/src/organizacao_financeira/service.rs` | SET updated_at, soft delete |
| `src-tauri/src/organizacao_financeira/repository.rs` | Filtrar deleted_at |
| `src-tauri/src/shared/settings.rs` | SET updated_at |
| `app/configuracoes/page.tsx` | Adicionar seção de sync |

---

## 18. Riscos e Mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| Mutex bloqueante durante sync | ALTO | Fetch/upload sem lock. Apply com lock curto. |
| Clock skew entre dispositivos | MÉDIO | Op_timestamp é referência. Convergência garantida. |
| Token refresh falha | MÉDIO | Retry com backoff. Status "Erro" na UI. |
| Google Drive quota | BAIXO | Batch uploads. Compressão. Rate limiting. |
| Passphrase errada | MÉDIO | Verificar decriptando manifest. Feedback ao usuário. |
| Dados corrompidos no Drive | BAIXO | Snapshots + operações. Recovery via último snapshot válido. |
| Muitas operações (performance) | MÉDIO | Batch apply. Version index. Paginação de arquivos. |
| Concurrent sync (dois pushes) | BAIXO | Mutex serializa syncs. Operações append-only. |
