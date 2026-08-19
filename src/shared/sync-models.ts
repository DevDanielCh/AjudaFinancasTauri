export type SyncStatusKind = "disconnected" | "synced" | "syncing" | "error" | "offline";

export interface SyncStatusInfo {
  kind: SyncStatusKind;
  message?: string;
}

export function parseSyncStatus(raw: string): SyncStatusInfo {
  if (raw.startsWith("error:")) {
    return { kind: "error", message: raw.slice(6) };
  }
  return { kind: raw as SyncStatusKind };
}
