ALTER TABLE transactions ADD COLUMN bill_start TEXT;
ALTER TABLE transactions ADD COLUMN bill_end TEXT;
CREATE INDEX idx_transactions_bill_start ON transactions(bill_start);
