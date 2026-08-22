-- =============================================================
-- Migration 010: Multi-conta (estilo Discord)
-- Uma conta = um "servidor". Todas as tabelas de dados ganham
-- account_id obrigatório referenciando accounts(id).
-- =============================================================

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#5865f2',
  uuid TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

-- Conta padrão para dados legados
INSERT INTO accounts (name, color) VALUES ('Pessoal', '#5865f2');

ALTER TABLE payment_methods ADD COLUMN account_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE categories ADD COLUMN account_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE fixed_bills ADD COLUMN account_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE loans ADD COLUMN account_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE transactions ADD COLUMN account_id INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_payment_methods_account ON payment_methods(account_id);
CREATE INDEX IF NOT EXISTS idx_categories_account ON categories(account_id);
CREATE INDEX IF NOT EXISTS idx_fixed_bills_account ON fixed_bills(account_id);
CREATE INDEX IF NOT EXISTS idx_loans_account ON loans(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);

-- ── settings por conta (PK composta); chaves de sistema usam account_id = 0 ──

CREATE TABLE settings_new (
  account_id INTEGER NOT NULL DEFAULT 1,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  uuid TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  PRIMARY KEY (account_id, key)
);

INSERT INTO settings_new (account_id, key, value, uuid, created_at, updated_at, deleted_at)
SELECT CASE WHEN key LIKE '\_%' ESCAPE '\' THEN 0 ELSE 1 END,
       key, value, uuid, created_at, updated_at, deleted_at
FROM settings;

DROP TABLE settings;
ALTER TABLE settings_new RENAME TO settings;

-- Triggers de settings refeitos para a PK composta
DROP TRIGGER IF EXISTS trg_settings_insert;
DROP TRIGGER IF EXISTS trg_settings_update;

CREATE TRIGGER trg_settings_insert AFTER INSERT ON settings
WHEN NEW.created_at IS NULL
BEGIN
  UPDATE settings
  SET created_at = datetime('now'), updated_at = datetime('now')
  WHERE account_id = NEW.account_id AND key = NEW.key;
END;

CREATE TRIGGER trg_settings_update AFTER UPDATE ON settings
BEGIN
  UPDATE settings
  SET updated_at = datetime('now')
  WHERE account_id = NEW.account_id AND key = NEW.key
    AND (SELECT value FROM _sync_config WHERE key = 'session') = '0';
END;

-- ── Conta ativa por dispositivo (local, não sincronizada) ──

CREATE TABLE IF NOT EXISTS _accounts_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
