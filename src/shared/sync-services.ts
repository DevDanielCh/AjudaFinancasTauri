import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { syncApi } from "./sync-repository";
import { parseSyncStatus } from "./sync-models";

export const syncKeys = {
  status: ["sync", "status"] as const,
  connected: ["sync", "connected"] as const,
};

export function useSyncStatus() {
  return useQuery({
    queryKey: syncKeys.status,
    queryFn: async () => {
      const raw = await syncApi.status();
      return parseSyncStatus(raw);
    },
    refetchInterval: (query) => {
      const status = query.state.data;
      return status?.kind === "syncing" ? 2_000 : 30_000;
    },
  });
}

export function useSyncConnected() {
  return useQuery({
    queryKey: syncKeys.connected,
    queryFn: () => syncApi.isConnected(),
    refetchInterval: 30_000,
  });
}

export function useSyncDisconnect() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => syncApi.disconnect(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: syncKeys.status });
      void client.invalidateQueries({ queryKey: syncKeys.connected });
    },
  });
}

export function useSyncNow() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => syncApi.syncNow(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: syncKeys.status });
    },
  });
}

export function useSyncAuto() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => syncApi.syncAuto(),
    onSuccess: () => {
      void client.invalidateQueries();
    },
  });
}

export function useSyncSetPassphrase() {
  return useMutation({
    mutationFn: (passphrase: string) => syncApi.setPassphrase(passphrase),
  });
}
