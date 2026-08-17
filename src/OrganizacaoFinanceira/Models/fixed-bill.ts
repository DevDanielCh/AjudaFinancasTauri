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
