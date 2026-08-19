-- =============================================================
-- Migration 009: Sync Engine infrastructure
-- =============================================================

-- ── Auxiliary tables ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _sync_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO _sync_config (key, value) VALUES ('session', '0');

CREATE TABLE IF NOT EXISTS _sync_counter (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO _sync_counter (key, value) VALUES ('current', 0);

-- ── Operation log (append-only) ─────────────────────────────

CREATE TABLE IF NOT EXISTS sync_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_uuid TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,
  op_timestamp TEXT NOT NULL,
  version INTEGER NOT NULL,
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_ops_version ON sync_operations(version);
CREATE INDEX IF NOT EXISTS idx_sync_ops_entity_uuid ON sync_operations(entity, entity_uuid);
CREATE INDEX IF NOT EXISTS idx_sync_ops_synced ON sync_operations(synced_at);

-- ── Sync state per device ───────────────────────────────────

CREATE TABLE IF NOT EXISTS sync_state (
  device_id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL,
  last_sync_version INTEGER NOT NULL DEFAULT 0,
  last_sync_at TEXT,
  device_name TEXT
);

-- ── Device registry ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS device_registry (
  device_id TEXT PRIMARY KEY,
  device_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  platform TEXT NOT NULL
);

-- =============================================================
-- New columns on existing entities
-- =============================================================

ALTER TABLE payment_methods ADD COLUMN uuid TEXT;
ALTER TABLE payment_methods ADD COLUMN created_at TEXT;
ALTER TABLE payment_methods ADD COLUMN updated_at TEXT;
ALTER TABLE payment_methods ADD COLUMN deleted_at TEXT;

ALTER TABLE categories ADD COLUMN uuid TEXT;
ALTER TABLE categories ADD COLUMN created_at TEXT;
ALTER TABLE categories ADD COLUMN updated_at TEXT;
ALTER TABLE categories ADD COLUMN deleted_at TEXT;

ALTER TABLE fixed_bills ADD COLUMN uuid TEXT;
ALTER TABLE fixed_bills ADD COLUMN created_at TEXT;
ALTER TABLE fixed_bills ADD COLUMN updated_at TEXT;
ALTER TABLE fixed_bills ADD COLUMN deleted_at TEXT;

ALTER TABLE loans ADD COLUMN uuid TEXT;
ALTER TABLE loans ADD COLUMN created_at TEXT;
ALTER TABLE loans ADD COLUMN updated_at TEXT;
ALTER TABLE loans ADD COLUMN deleted_at TEXT;

ALTER TABLE transactions ADD COLUMN uuid TEXT;
ALTER TABLE transactions ADD COLUMN created_at TEXT;
ALTER TABLE transactions ADD COLUMN updated_at TEXT;
ALTER TABLE transactions ADD COLUMN deleted_at TEXT;

ALTER TABLE settings ADD COLUMN uuid TEXT;
ALTER TABLE settings ADD COLUMN created_at TEXT;
ALTER TABLE settings ADD COLUMN updated_at TEXT;
ALTER TABLE settings ADD COLUMN deleted_at TEXT;

-- =============================================================
-- Triggers — timestamps only (UUIDs generated in Rust)
-- =============================================================
-- UPDATE trigger: always fires, checks session flag internally.
-- When session = '1' (sync pull), the UPDATE is a no-op.
-- When session = '0' (local), updated_at is set to now.
-- INSERT trigger: sets created_at/updated_at when absent.

-- payment_methods ────────────────────────────────────────────

CREATE TRIGGER trg_pm_insert AFTER INSERT ON payment_methods
WHEN NEW.created_at IS NULL
BEGIN
  UPDATE payment_methods
  SET created_at = datetime('now'), updated_at = datetime('now')
  WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER trg_pm_update AFTER UPDATE ON payment_methods
BEGIN
  UPDATE payment_methods
  SET updated_at = datetime('now')
  WHERE rowid = NEW.rowid
    AND (SELECT value FROM _sync_config WHERE key = 'session') = '0';
END;

-- categories ─────────────────────────────────────────────────

CREATE TRIGGER trg_cat_insert AFTER INSERT ON categories
WHEN NEW.created_at IS NULL
BEGIN
  UPDATE categories
  SET created_at = datetime('now'), updated_at = datetime('now')
  WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER trg_cat_update AFTER UPDATE ON categories
BEGIN
  UPDATE categories
  SET updated_at = datetime('now')
  WHERE rowid = NEW.rowid
    AND (SELECT value FROM _sync_config WHERE key = 'session') = '0';
END;

-- fixed_bills ────────────────────────────────────────────────

CREATE TRIGGER trg_fb_insert AFTER INSERT ON fixed_bills
WHEN NEW.created_at IS NULL
BEGIN
  UPDATE fixed_bills
  SET created_at = datetime('now'), updated_at = datetime('now')
  WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER trg_fb_update AFTER UPDATE ON fixed_bills
BEGIN
  UPDATE fixed_bills
  SET updated_at = datetime('now')
  WHERE rowid = NEW.rowid
    AND (SELECT value FROM _sync_config WHERE key = 'session') = '0';
END;

-- loans ──────────────────────────────────────────────────────

CREATE TRIGGER trg_loan_insert AFTER INSERT ON loans
WHEN NEW.created_at IS NULL
BEGIN
  UPDATE loans
  SET created_at = datetime('now'), updated_at = datetime('now')
  WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER trg_loan_update AFTER UPDATE ON loans
BEGIN
  UPDATE loans
  SET updated_at = datetime('now')
  WHERE rowid = NEW.rowid
    AND (SELECT value FROM _sync_config WHERE key = 'session') = '0';
END;

-- transactions ───────────────────────────────────────────────

CREATE TRIGGER trg_tx_insert AFTER INSERT ON transactions
WHEN NEW.created_at IS NULL
BEGIN
  UPDATE transactions
  SET created_at = datetime('now'), updated_at = datetime('now')
  WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER trg_tx_update AFTER UPDATE ON transactions
BEGIN
  UPDATE transactions
  SET updated_at = datetime('now')
  WHERE rowid = NEW.rowid
    AND (SELECT value FROM _sync_config WHERE key = 'session') = '0';
END;

-- settings ───────────────────────────────────────────────────

CREATE TRIGGER trg_settings_insert AFTER INSERT ON settings
WHEN NEW.created_at IS NULL
BEGIN
  UPDATE settings
  SET created_at = datetime('now'), updated_at = datetime('now')
  WHERE key = NEW.key;
END;

CREATE TRIGGER trg_settings_update AFTER UPDATE ON settings
BEGIN
  UPDATE settings
  SET updated_at = datetime('now')
  WHERE key = NEW.key
    AND (SELECT value FROM _sync_config WHERE key = 'session') = '0';
END;
