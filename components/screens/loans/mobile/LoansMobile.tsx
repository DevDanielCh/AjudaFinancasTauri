"use client";
import { CrudPageMobile } from "@/components/crud/CrudPageMobile";
import type { CrudConfig } from "@/components/crud/types";
import type { PaymentMethod } from "@/src/OrganizacaoFinanceira/Models/payment-method";
import type { Loan, LoanInput } from "@/src/OrganizacaoFinanceira/Models/loan";

type Resources = { paymentMethods: PaymentMethod[] };

export function LoansMobile({
  config,
}: {
  config: CrudConfig<Loan, LoanInput, Resources>;
}) {
  return <CrudPageMobile config={config} />;
}