"use client";
import type { LoanInput } from "../../Models/loan";
import type { PaymentMethod } from "../../Models/payment-method";
import type { CrudFormApi } from "@/lib/forms";
import { FinanciamentoAddForm } from "./FinanciamentoAddForm";

export function FinanciamentoEditForm({
  form,
  resources,
  serverError,
}: {
  form: CrudFormApi<LoanInput>;
  resources: { paymentMethods: PaymentMethod[] } | undefined;
  serverError: string | null;
}) {
  return <FinanciamentoAddForm form={form} resources={resources} serverError={serverError} />;
}
