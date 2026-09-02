import { invoke } from "@tauri-apps/api/core";
import type { Sort } from "@/src/shared/models";
import type { CardBillDetail, TransactionInput, TransactionRow } from "../Models/transaction";

export const transactionApi = {
  list: (month: string | null, sort: Sort | null = null) =>
    invoke<TransactionRow[]>("list_transactions", {
      month,
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
  create: (input: TransactionInput) => invoke<void>("create_transaction", { input }),
  update: (id: number, input: TransactionInput) =>
    invoke<void>("update_transaction", { id, input }),
  remove: (ids: number[]) => invoke<void>("delete_transactions", { ids }),
  getCardBill: (id: number) => invoke<CardBillDetail>("get_card_bill", { id }),
  listCardBillTransactions: (id: number, sort: Sort | null = null) =>
    invoke<CardBillDetail>("list_card_bill_transactions", {
      id,
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
};
