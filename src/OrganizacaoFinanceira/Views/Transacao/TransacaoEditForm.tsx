"use client";
import type { Category } from "../../Models/category";
import type { PaymentMethod } from "../../Models/payment-method";
import type { TransactionInput } from "../../Models/transaction";
import type { CrudFormApi } from "@/lib/forms";
import { TransacaoAddForm } from "./TransacaoAddForm";

export function TransacaoEditForm({
  form,
  resources,
  serverError,
}: {
  form: CrudFormApi<TransactionInput>;
  resources: { categories: Category[]; paymentMethods: PaymentMethod[] } | undefined;
  serverError: string | null;
}) {
  return <TransacaoAddForm form={form} resources={resources} serverError={serverError} />;
}
