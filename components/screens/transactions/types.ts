import type { Category } from "@/src/OrganizacaoFinanceira/Models/category";
import type { PaymentMethod } from "@/src/OrganizacaoFinanceira/Models/payment-method";

export type TransactionsResources = {
  categories: Category[];
  paymentMethods: PaymentMethod[];
};