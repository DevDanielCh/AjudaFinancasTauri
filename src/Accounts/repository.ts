import { invoke } from "@tauri-apps/api/core";
import type { AccountInfo, AccountInput } from "./models";

export const accountsApi = {
  list: () => invoke<AccountInfo[]>("list_accounts"),
  getActive: () => invoke<AccountInfo>("get_active_account"),
  create: (input: AccountInput) =>
    invoke<AccountInfo>("create_account", { input }),
  update: (uuid: string, input: AccountInput) =>
    invoke<void>("update_account", { uuid, input }),
  remove: (uuid: string) => invoke<AccountInfo>("delete_account", { uuid }),
  setActive: (uuid: string) =>
    invoke<AccountInfo>("set_active_account", { uuid }),
};
