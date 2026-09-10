"use client";
import { CrudPageDesktop } from "@/components/crud/CrudPageDesktop";
import type { CrudConfig } from "@/components/crud/types";
import type { TransactionInput, TransactionRow } from "@/src/OrganizacaoFinanceira/Models/transaction";
import type { TransactionsResources } from "../types";

export function TransactionsDesktop({
  config,
  autoCreate,
}: {
  config: CrudConfig<TransactionRow, TransactionInput, TransactionsResources>;
  autoCreate?: boolean;
}) {
  return <CrudPageDesktop config={config} autoCreate={autoCreate} />;
}