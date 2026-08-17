import { invoke } from "@tauri-apps/api/core";
import type { Sort } from "@/src/shared/models";
import type { Category, CategoryInput } from "../Models/category";

export const categoryApi = {
  list: (sort: Sort | null = null) =>
    invoke<Category[]>("list_categories", {
      sortBy: sort?.id,
      sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    }),
  create: (input: CategoryInput) => invoke<void>("create_category", { input }),
  update: (id: number, input: CategoryInput) =>
    invoke<void>("update_category", { id, input }),
  remove: (ids: number[]) => invoke<void>("delete_categories", { ids }),
};
