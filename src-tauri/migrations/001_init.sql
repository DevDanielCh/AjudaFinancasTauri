CREATE TABLE payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type INTEGER NOT NULL,
  metadata TEXT
);
CREATE INDEX idx_payment_methods_type ON payment_methods(type);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type INTEGER NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  icon TEXT
);
CREATE INDEX idx_categories_type ON categories(type);

CREATE TABLE fixed_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  day INTEGER NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id),
  start_month TEXT NOT NULL,
  end_month TEXT,
  installments INTEGER
);

CREATE TABLE loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type INTEGER NOT NULL,
  description TEXT NOT NULL,
  principal INTEGER NOT NULL,
  installment INTEGER NOT NULL,
  total_installments INTEGER NOT NULL,
  day INTEGER NOT NULL,
  start_month TEXT NOT NULL,
  payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id)
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type INTEGER NOT NULL,
  date TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  payment_method_id INTEGER REFERENCES payment_methods(id),
  fixed_bill_id INTEGER REFERENCES fixed_bills(id) ON DELETE SET NULL,
  loan_id INTEGER REFERENCES loans(id) ON DELETE SET NULL
);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_payment_method ON transactions(payment_method_id);
CREATE INDEX idx_transactions_fixed_bill ON transactions(fixed_bill_id);
CREATE INDEX idx_transactions_loan ON transactions(loan_id);

INSERT INTO payment_methods (name, type, metadata) VALUES ('PIX', 1, NULL), ('Boleto', 1, NULL);
