import { invoke } from "@tauri-apps/api/core";
import type {
  CardBillDetail, Category, CategoryInput, ChartData, DashboardData, FixedBill, FixedBillInput,
  Loan, LoanDetail, LoanInput, PaymentMethod, PaymentMethodInput, Settings, SettingsInput,
  Sort,
  TransactionInput,
  TransactionRow,
} from "./types";

export const api = {
  getEarliestMonth: () => invoke<string>("get_earliest_month"),
  getVersion: () => invoke<string>("get_version"),
  getSettings: () => invoke<Settings>("get_settings"),
  updateSettings: (input: SettingsInput) => invoke<void>("update_settings", { input }),
  getDashboard: (month: string) => invoke<DashboardData>("get_dashboard", { month }),
  syncDashboard: (month: string) => invoke<DashboardData>("sync_dashboard", { month }),
  getChartData: (month: string | null) => invoke<ChartData>("get_chart_data", { month }),
  listTransactions: (month: string | null, sort: Sort | null = null) =>
    invoke<TransactionRow[]>("list_transactions", {
      month,
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
  listReservaMovements: () => invoke<TransactionRow[]>("list_reserva_movements"),
  createTransaction: (input: TransactionInput) =>
    invoke<void>("create_transaction", { input }),
  updateTransaction: (id: number, input: TransactionInput) =>
    invoke<void>("update_transaction", { id, input }),
  deleteTransactions: (ids: number[]) =>
    invoke<void>("delete_transactions", { ids }),
  getCardBill: (id: number) => invoke<CardBillDetail>("get_card_bill", { id }),
  listPaymentMethods: (sort: Sort | null = null) =>
    invoke<PaymentMethod[]>("list_payment_methods", {
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
  createPaymentMethod: (input: PaymentMethodInput) =>
    invoke<void>("create_payment_method", { input }),
  updatePaymentMethod: (id: number, input: PaymentMethodInput) =>
    invoke<void>("update_payment_method", { id, input }),
  deletePaymentMethods: (ids: number[]) =>
    invoke<void>("delete_payment_methods", { ids }),
  listCategories: (sort: Sort | null = null) =>
    invoke<Category[]>("list_categories", {
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
  createCategory: (input: CategoryInput) => invoke<void>("create_category", { input }),
  updateCategory: (id: number, input: CategoryInput) =>
    invoke<void>("update_category", { id, input }),
  deleteCategories: (ids: number[]) => invoke<void>("delete_categories", { ids }),
  listFixedBills: (onlyInstallments: boolean, sort: Sort | null = null) =>
    invoke<FixedBill[]>("list_fixed_bills", {
      onlyInstallments,
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
  createFixedBill: (input: FixedBillInput) => invoke<void>("create_fixed_bill", { input }),
  updateFixedBill: (id: number, input: FixedBillInput) =>
    invoke<void>("update_fixed_bill", { id, input }),
  deleteFixedBills: (ids: number[]) => invoke<void>("delete_fixed_bills", { ids }),
  listLoans: (sort: Sort | null = null) =>
    invoke<Loan[]>("list_loans", {
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
  getLoanDetail: (id: number) => invoke<LoanDetail>("get_loan_detail", { id }),
  createLoan: (input: LoanInput) => invoke<void>("create_loan", { input }),
  updateLoan: (id: number, input: LoanInput) => invoke<void>("update_loan", { id, input }),
  deleteLoans: (ids: number[]) => invoke<void>("delete_loans", { ids }),
};

export function msg(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : "Erro desconhecido";
}
