import { invoke } from "@tauri-apps/api/core";
import type { Sort } from "@/src/shared/models";
import type { FixedBill, FixedBillInput } from "../Models/fixed-bill";

export const fixedBillApi = {
  list: (onlyInstallments: boolean, sort: Sort | null = null) =>
    invoke<FixedBill[]>("list_fixed_bills", {
      onlyInstallments,
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
  create: (input: FixedBillInput) => invoke<void>("create_fixed_bill", { input }),
  update: (id: number, input: FixedBillInput) =>
    invoke<void>("update_fixed_bill", { id, input }),
  remove: (ids: number[]) => invoke<void>("delete_fixed_bills", { ids }),
};
