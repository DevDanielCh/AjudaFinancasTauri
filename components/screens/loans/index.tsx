"use client";
import { Suspense } from "react";
import { PlatformView } from "@/components/PlatformView";
import type { CrudConfig } from "@/components/crud/types";
import { FinanciamentoViewForm } from "@/src/OrganizacaoFinanceira/Views/Financiamento/FinanciamentoViewForm";
import type { PaymentMethod } from "@/src/OrganizacaoFinanceira/Models/payment-method";
import type { Loan, LoanInput } from "@/src/OrganizacaoFinanceira/Models/loan";
import { LoansDesktop } from "./desktop/LoansDesktop";
import { LoansMobile } from "./mobile/LoansMobile";

type Resources = { paymentMethods: PaymentMethod[] };

export function LoansScreen({
  config,
  detailId,
  onDetailClose,
}: {
  config: CrudConfig<Loan, LoanInput, Resources>;
  detailId: number | null;
  onDetailClose: () => void;
}) {
  return (
    <Suspense fallback={null}>
      <>
        <PlatformView
          mobile={<LoansMobile config={config} />}
          desktop={<LoansDesktop config={config} />}
        />
        <FinanciamentoViewForm id={detailId} onClose={onDetailClose} />
      </>
    </Suspense>
  );
}