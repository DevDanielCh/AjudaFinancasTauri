"use client";
import { CrudPageMobile } from "@/components/crud/CrudPageMobile";
import type { CrudConfig } from "@/components/crud/types";
import type { TransactionInput, TransactionRow } from "@/src/OrganizacaoFinanceira/Models/transaction";
import type { TransactionsResources } from "../types";

export function TransactionsMobile({
  config,
  autoCreate,
}: {
  config: CrudConfig<TransactionRow, TransactionInput, TransactionsResources>;
  autoCreate?: boolean;
}) {
  return <CrudPageMobile config={config} autoCreate={autoCreate} />;
}