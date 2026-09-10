import type { ChartData, DashboardData } from "@/src/shared/models";

export type DashboardScreenProps = {
  month: string;
  data: DashboardData | undefined;
  chart: ChartData | undefined;
  isFetching: boolean;
  onSync: () => Promise<void>;
  onRetry: () => void;
};