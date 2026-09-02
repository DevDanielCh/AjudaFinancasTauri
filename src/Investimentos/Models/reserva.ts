import type { TransactionRow, TransactionInput } from "@/src/OrganizacaoFinanceira/Models/transaction";

export type ReservaRow = TransactionRow;

export type ReservaInput = Pick<TransactionInput, "description" | "amount" | "type" | "date"> & {
  /** Movimento também gera despesa/receita na conta principal (default: true). */
  in_principal: boolean;
};
