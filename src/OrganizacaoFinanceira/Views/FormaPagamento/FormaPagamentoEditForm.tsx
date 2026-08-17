"use client";
import type { PaymentMethodInput } from "../../Models/payment-method";
import type { CrudFormApi } from "@/lib/forms";
import { FormaPagamentoAddForm } from "./FormaPagamentoAddForm";

export function FormaPagamentoEditForm({
  form,
  serverError,
}: {
  form: CrudFormApi<PaymentMethodInput>;
  serverError: string | null;
}) {
  return <FormaPagamentoAddForm form={form} serverError={serverError} />;
}
