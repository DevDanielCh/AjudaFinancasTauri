"use client";
import { useMonth } from "@/lib/month-context";
import { msg } from "@/src/shared/repository";
import { useDashboard, useChartData, useSyncDashboard } from "@/src/shared/services";
import { toast } from "@/components/ui/toast";
import { DashboardScreen } from "@/components/screens/dashboard";

export default function DashboardPage() {
  const { month } = useMonth();
  const dashboardQuery = useDashboard(month);
  const chartQuery = useChartData(month);
  const syncMutation = useSyncDashboard(month);

  const doSync = async () => {
    try {
      await syncMutation.mutateAsync();
      toast.add({ title: "Sincronizado com sucesso", type: "success" });
    } catch (e) {
      toast.add({ title: msg(e), type: "error" });
    }
  };

  return (
    <DashboardScreen
      month={month}
      data={dashboardQuery.data}
      chart={chartQuery.data}
      isFetching={dashboardQuery.isFetching}
      onSync={doSync}
      onRetry={() => void dashboardQuery.refetch()}
    />
  );
}