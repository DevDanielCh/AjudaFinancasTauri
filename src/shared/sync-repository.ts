import { invoke } from "@tauri-apps/api/core";

export const syncApi = {
  startAuth: () => invoke<string>("sync_start_auth"),
  completeAuth: () => invoke<string>("sync_complete_auth"),
  openUrl: (url: string) => invoke<void>("sync_open_url", { url }),
  disconnect: () => invoke<void>("sync_disconnect"),
  status: () => invoke<string>("sync_status"),
  syncNow: () => invoke<string>("sync_now"),
  syncAuto: () => invoke<string>("sync_auto"),
  isConnected: () => invoke<boolean>("sync_is_connected"),
  setPassphrase: (passphrase: string) =>
    invoke<void>("sync_set_passphrase", { passphrase }),
};
