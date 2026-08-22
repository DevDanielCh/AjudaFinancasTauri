import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { sharedApi } from "./repository";
import type { SettingsInput } from "./models";

export const dashboardKeys = (month: string | null) => ["dashboard", month] as const;
export const chartKeys = (month: string | null) => ["chart-data", month] as const;
export const settingsKeys = ["settings"] as const;
export const earliestMonthKeys = ["earliest-month"] as const;

export function useDashboard(month: string | null) {
  return useQuery({
    queryKey: dashboardKeys(month),
    queryFn: () => sharedApi.getDashboard(month ?? ""),
  });
}

export function useChartData(month: string | null) {
  return useQuery({
    queryKey: chartKeys(month),
    queryFn: () => sharedApi.getChartData(month),
  });
}

export function useSyncDashboard(month: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => sharedApi.syncDashboard(month),
    onSuccess: () => {
      // ponytail: DB global único; invalidar tudo é simples e suficiente.
      void client.invalidateQueries();
    },
  });
}

export function useRevalidateGenerated() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => sharedApi.revalidateGenerated(),
    onSuccess: () => {
      void client.invalidateQueries();
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys,
    queryFn: () => sharedApi.getSettings(),
    staleTime: 15_000,
  });
}

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsInput) => sharedApi.updateSettings(input),
    onSuccess: () => {
      // ponytail: DB global único; invalidar tudo é simples e suficiente.
      void client.invalidateQueries();
    },
  });
}
