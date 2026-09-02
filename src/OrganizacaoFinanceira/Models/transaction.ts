export type TransactionType = 1 | 2 | 3 | 4 | 5;

export interface TransactionRow {
  id: number;
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  category_id: number | null;
  category_name: string | null;
  payment_method_id: number | null;
  payment_method_name: string | null;
  fixed_bill_id: number | null;
  loan_id: number | null;
  is_card_bill: boolean;
  card_mode: 0 | 1;
  /** Movimento também gera despesa/receita na conta principal. */
  in_principal?: boolean;
  installment: string | null;
}

export interface CardBillDetail {
  id: number;
  description: string;
  payment_method_name: string;
  period_start: string;
  period_end: string;
  due_date: string;
  total: number;
  transactions: TransactionRow[];
}

export interface TransactionInput {
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  category_id: number | null;
  payment_method_id: number | null;
  card_mode: 0 | 1;
  /** Movimento também gera despesa/receita na conta principal (default: true). */
  in_principal?: boolean;
}
