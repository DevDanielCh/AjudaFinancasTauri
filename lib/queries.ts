import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";
import type { SettingsInput } from "./types";

export const queryKeys = {
  dashboard: (month: string | null) => ["dashboard", month] as const,
  chart: (month: string | null) => ["chart-data", month] as const,
  transactions: (month: string | null) => ["transactions", month] as const,
  categories: ["categories"] as const,
  paymentMethods: ["payment-methods"] as const,
  fixedBills: (finished: boolean) => ["fixed-bills", finished] as const,
  loans: ["loans"] as const,
  reserva: ["reserva"] as const,
  settings: ["settings"] as const,
  earliestMonth: ["earliest-month"] as const,
};

export function useDashboard(month: string | null) {
  return useQuery({
    queryKey: queryKeys.dashboard(month),
    queryFn: () => api.getDashboard(month ?? ""),
  });
}

export function useChartData(month: string | null) {
  return useQuery({
    queryKey: queryKeys.chart(month),
    queryFn: () => api.getChartData(month),
  });
}

export function useSyncDashboard(month: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.syncDashboard(month),
    onSuccess: () => {
      // ponytail: DB global único; invalidar tudo é simples e suficiente.
      void client.invalidateQueries();
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api.getSettings(),
    staleTime: 15_000,
  });
}

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsInput) => api.updateSettings(input),
    onSuccess: () => {
      // ponytail: DB global único; invalidar tudo é simples e suficiente.
      void client.invalidateQueries();
    },
  });
}
