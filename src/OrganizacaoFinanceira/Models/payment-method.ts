export interface PaymentMethod {
  id: number;
  name: string;
  type: 1 | 2;
  metadata: string | null;
}

export interface PaymentMethodInput {
  name: string;
  type: 1 | 2;
  close_day: number | null;
  validity_day: number | null;
}
