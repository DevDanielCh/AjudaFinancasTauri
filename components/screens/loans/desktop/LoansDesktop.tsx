"use client";
import { CrudPageDesktop } from "@/components/crud/CrudPageDesktop";
import type { CrudConfig } from "@/components/crud/types";
import type { PaymentMethod } from "@/src/OrganizacaoFinanceira/Models/payment-method";
import type { Loan, LoanInput } from "@/src/OrganizacaoFinanceira/Models/loan";

type Resources = { paymentMethods: PaymentMethod[] };

export function LoansDesktop({
  config,
}: {
  config: CrudConfig<Loan, LoanInput, Resources>;
}) {
  return <CrudPageDesktop config={config} />;
}