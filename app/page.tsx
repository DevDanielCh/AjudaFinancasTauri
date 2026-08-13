"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useMonth } from "@/lib/month-context";
import { Spinner } from "@/components/ui/spinner";
import { msg } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDashboard, useChartData, useSyncDashboard } from "@/lib/queries";
import { ChartSection } from "@/components/dashboard/ChartSection";
import { PullToRefresh } from "@/components/PullToRefresh";

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

  const data = dashboardQuery.data;

  if (dashboardQuery.isError && !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-muted-foreground">Falha ao carregar o dashboard</p>
        <Button variant="outline" onClick={() => dashboardQuery.refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={() => doSync()}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="hidden text-2xl font-semibold tracking-tight sm:block">Dashboard</h1>
          <Button variant="outline" size="sm" disabled={dashboardQuery.isFetching} onClick={() => void doSync()}
            className="hidden sm:inline-flex">
            <RefreshCw data-icon="inline-start" className={cn(dashboardQuery.isFetching && "animate-spin")} />
            {dashboardQuery.isFetching ? "Sincronizando..." : "Sincronizar"}
          </Button>
        </div>

        {!data ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Receitas" value={formatMoney(data.income)} positive>
                {data.income_by_cat.length > 0 && (
                  <>
                    <Separator className="mt-2 mb-2" />
                    <div className="flex flex-col gap-1">
                      {data.income_by_cat.map((b) => (
                        <div key={b.name} className="flex items-center justify-between text-sm">
                          <span>{b.name}</span>
                          <span className="text-positive">{formatMoney(b.total)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </StatCard>
              <StatCard label="Despesas" value={formatMoney(data.expenses)} negative>
                {data.expenses_by_pm.length > 0 && (
                  <>
                    <Separator className="mt-2 mb-2" />
                    <div className="flex flex-col gap-1">
                      {data.expenses_by_pm.map((b) => (
                        <div key={b.name} className="flex items-center justify-between text-sm">
                          <span>{b.name}</span>
                          <span className="text-negative">{formatMoney(b.total)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </StatCard>
              <StatCard label="Saldo do mês" value={formatMoney(data.income - data.expenses)}
                positive={data.income - data.expenses >= 0} />
              <StatCard label="Saldo acumulado" value={formatMoney(data.balance)}
                positive={data.balance >= 0} />
            </div>
            {chartQuery.data && <ChartSection data={chartQuery.data} />}
          </>
        )}
      </div>
    </PullToRefresh>
  );
}

function StatCard({ label, value, positive, negative, children }: { label: string; value: string; positive?: boolean; negative?: boolean; children?: React.ReactNode }) {
  const cls = positive ? "text-positive"
    : negative ? "text-negative" : "";
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold tabular-nums font-mono", cls)}>{value}</div>
        {children}
      </CardContent>
    </Card>
  );
}
