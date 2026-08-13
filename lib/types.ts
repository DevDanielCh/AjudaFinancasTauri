export interface PaymentMethod {
  id: number;
  name: string;
  type: 1 | 2;
  metadata: string | null;
}

export interface Category {
  id: number;
  name: string;
  type: 1 | 2;
  color: string;
  icon: string | null;
}

export interface TransactionRow {
  id: number;
  description: string;
  amount: number;
  type: 1 | 2 | 3;
  date: string;
  category_id: number | null;
  category_name: string | null;
  payment_method_id: number | null;
  payment_method_name: string | null;
  fixed_bill_id: number | null;
  loan_id: number | null;
  is_card_bill: boolean;
  card_mode: 0 | 1;
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
  type: 1 | 2;
  date: string;
  category_id: number | null;
  payment_method_id: number | null;
  card_mode: 0 | 1;
}

export interface PaymentMethodInput {
  name: string;
  type: 1 | 2;
  close_day: number | null;
  validity_day: number | null;
}

export interface CategoryInput {
  name: string;
  type: 1 | 2;
  color: string;
  icon: string | null;
}

export interface FixedBill {
  id: number;
  description: string;
  amount: number;
  day: number;
  category_id: number | null;
  category_name: string | null;
  payment_method_id: number;
  payment_method_name: string;
  start_month: string;
  end_month: string | null;
  installments: number | null;
  purchase_date: string | null;
  finished: boolean;
}

export interface FixedBillInput {
  description: string;
  amount: number;
  day: number;
  category_id: number | null;
  payment_method_id: number;
  start_month: string;
  end_month: string | null;
  installments: number | null;
  purchase_date: string | null;
}

export interface Loan {
  id: number;
  type: 1 | 2;
  description: string;
  principal: number;
  installment: number;
  total_installments: number;
  day: number;
  start_month: string;
  payment_method_id: number;
  payment_method_name: string;
  total_paid: number;
  total_interest: number;
  end_month: string;
  paid_count: number;
  monthly_rate: number;
}

export interface LoanInput {
  type: 1 | 2;
  description: string;
  principal: number;
  installment: number;
  total_installments: number;
  day: number;
  start_month: string;
  payment_method_id: number;
  monthly_rate: number;
}

export interface AmortizationRow {
  number: number;
  month: string;
  installment: number;
  interest: number;
  principal: number;
  balance: number;
  settlement: number;
}

export interface LoanDetail {
  loan: Loan;
  schedule: AmortizationRow[];
}

export interface BreakdownRow {
  name: string;
  total: number;
}

export interface DashboardData {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  prev_balance: number;
  income_by_cat: BreakdownRow[];
  expenses_by_pm: BreakdownRow[];
}

export interface MonthlyPoint {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

export interface ChartData {
  monthly: MonthlyPoint[];
  expenses_by_cat: BreakdownRow[];
}
