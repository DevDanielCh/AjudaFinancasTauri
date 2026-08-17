"use client";
import type { FixedBillInput } from "../../Models/fixed-bill";
import type { CrudFormApi } from "@/lib/forms";
import { ContaFixaAddForm, type FixedBillResources } from "./ContaFixaAddForm";

export function ContaFixaEditForm({
  form,
  resources,
  serverError,
  mode,
}: {
  form: CrudFormApi<FixedBillInput>;
  resources: FixedBillResources | undefined;
  serverError: string | null;
  mode: "recurring" | "installments";
}) {
  return <ContaFixaAddForm form={form} resources={resources} serverError={serverError} mode={mode} />;
}
