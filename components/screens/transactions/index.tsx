"use client";
import { Suspense } from "react";
import { PlatformView } from "@/components/PlatformView";
import type { CrudConfig } from "@/components/crud/types";
import { TransacaoViewForm } from "@/src/OrganizacaoFinanceira/Views/Transacao/TransacaoViewForm";
import type { TransactionInput, TransactionRow } from "@/src/OrganizacaoFinanceira/Models/transaction";
import type { TransactionsResources } from "./types";
import { TransactionsDesktop } from "./desktop/TransactionsDesktop";
import { TransactionsMobile } from "./mobile/TransactionsMobile";

export function TransactionsScreen({
  config,
  faturaId,
  onFaturaClose,
  autoCreate,
}: {
  config: CrudConfig<TransactionRow, TransactionInput, TransactionsResources>;
  faturaId: number | null;
  onFaturaClose: () => void;
  autoCreate?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <>
        <PlatformView
          mobile={<TransactionsMobile config={config} autoCreate={autoCreate} />}
          desktop={<TransactionsDesktop config={config} autoCreate={autoCreate} />}
        />
        <TransacaoViewForm id={faturaId} onClose={onFaturaClose} />
      </>
    </Suspense>
  );
}