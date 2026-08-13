import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";

export const queryKeys = {
  dashboard: (month: string | null) => ["dashboard", month] as const,
  chart: (month: string | null) => ["chart-data", month] as const,
  transactions: (month: string | null) => ["transactions", month] as const,
  categories: ["categories"] as const,
  paymentMethods: ["payment-methods"] as const,
  fixedBills: (finished: boolean) => ["fixed-bills", finished] as const,
  loans: ["loans"] as const,
  reserva: ["reserva"] as const,
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
