import { invoke } from "@tauri-apps/api/core";
import type { Sort } from "@/src/shared/models";
import type { Loan, LoanDetail, LoanInput } from "../Models/loan";

export const loanApi = {
  list: (sort: Sort | null = null) =>
    invoke<Loan[]>("list_loans", {
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
  getDetail: (id: number) => invoke<LoanDetail>("get_loan_detail", { id }),
  create: (input: LoanInput) => invoke<void>("create_loan", { input }),
  update: (id: number, input: LoanInput) => invoke<void>("update_loan", { id, input }),
  remove: (ids: number[]) => invoke<void>("delete_loans", { ids }),
};
