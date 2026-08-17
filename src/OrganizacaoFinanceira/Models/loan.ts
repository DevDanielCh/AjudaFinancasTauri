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
