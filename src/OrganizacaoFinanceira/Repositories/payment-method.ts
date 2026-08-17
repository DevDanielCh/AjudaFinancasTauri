import { invoke } from "@tauri-apps/api/core";
import type { Sort } from "@/src/shared/models";
import type { PaymentMethod, PaymentMethodInput } from "../Models/payment-method";

export const paymentMethodApi = {
  list: (sort: Sort | null = null) =>
    invoke<PaymentMethod[]>("list_payment_methods", {
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
  create: (input: PaymentMethodInput) =>
    invoke<void>("create_payment_method", { input }),
  update: (id: number, input: PaymentMethodInput) =>
    invoke<void>("update_payment_method", { id, input }),
  remove: (ids: number[]) => invoke<void>("delete_payment_methods", { ids }),
};
