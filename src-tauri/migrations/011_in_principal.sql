-- =============================================================
-- Migration 011: flag "movimenta a conta principal"
-- Transações de reserva (type 4/5) normalmente viram despesa/receita
-- na conta principal. Com in_principal = 0 o movimento só altera o
-- saldo da reserva (ex.: rendimento), sem efeito em income/expense
-- da conta principal nem nos aportes da meta.
-- =============================================================

ALTER TABLE transactions ADD COLUMN in_principal INTEGER NOT NULL DEFAULT 1;