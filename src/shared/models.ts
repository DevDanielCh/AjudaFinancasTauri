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
  meta_investimento: number;
  aportes: number;
  income_by_cat: BreakdownRow[];
  expenses_by_pm: BreakdownRow[];
}

export interface MonthlyPoint {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  reserva: number;
}

export interface ChartData {
  monthly: MonthlyPoint[];
  expenses_by_cat: BreakdownRow[];
  expenses_by_pm: BreakdownRow[];
}

export interface Settings {
  primeiro_mes: string | null;
  saldo_inicial_conta: number;
  saldo_inicial_reserva: number;
  meta_investimento: number;
}

export interface SettingsInput {
  primeiro_mes: string | null;
  saldo_inicial_conta: number;
  saldo_inicial_reserva: number;
  meta_investimento: number;
}

export interface Sort {
  id: string;
  desc: boolean;
}
