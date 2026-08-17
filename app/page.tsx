"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useMonth } from "@/lib/month-context";
import { Spinner } from "@/components/ui/spinner";
import { msg } from "@/src/shared/repository";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDashboard, useChartData, useSyncDashboard } from "@/src/shared/services";
import { ChartSection } from "@/components/dashboard/ChartSection";
import { PullToRefresh } from "@/components/PullToRefresh";
import { barY, group, defineChart } from "@tanstack/charts";
import { scaleBand, scaleLinear } from "d3-scale";
import { Chart } from "@tanstack/charts/react";

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
      <div className="flex flex-col gap-4 pb-4 sm:h-[calc(100vh-1.5rem)] sm:overflow-y-auto sm:pr-2">
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
            {data.meta_investimento > 0 && (
              <MetaCard pct={data.meta_investimento} income={data.income} aportes={data.aportes} />
            )}
            {chartQuery.data && <ChartSection data={chartQuery.data} month={month} />}
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

function MetaCard({ pct, income, aportes }: { pct: number; income: number; aportes: number }) {
  const metaValor = Math.round((income * pct) / 100);
  const atingiu = metaValor > 0 && aportes >= metaValor;

  const chartData = React.useMemo(
    () => [
      { series: "Meta", value: metaValor },
      { series: "Aportes", value: aportes },
    ],
    [metaValor, aportes],
  );

  const definition = React.useMemo(
    () =>
      defineChart({
        marks: [
          barY(chartData, {
            x: "series",
            y: "value",
            color: "series",
            layout: group({
              scale: scaleBand<string>().domain(["Meta", "Aportes"]).paddingInner(0.2),
            }),
            inset: 1,
            radius: 4,
          }),
        ],
        x: {
          scale: () => scaleBand<string>().padding(0.3),
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: { ticks: { format: (v: number) => formatMoney(v) } },
        },
        color: {
          domain: ["Meta", "Aportes"],
          range: ["hsl(var(--muted-foreground) / 0.35)", "hsl(var(--chart-2))"],
        },
      }),
    [chartData],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
          Meta de investimento
          <Badge className={cn(atingiu ? "bg-positive text-positive-foreground" : "bg-negative text-negative-foreground")}>
            {atingiu ? "Meta batida" : "Não bateu"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Chart definition={definition} height={160} ariaLabel="Meta de investimento vs aportes" />
        <p className="text-sm text-muted-foreground">
          {pct.toLocaleString("pt-BR")}% da renda · aportado {formatMoney(aportes)} no mês
        </p>
      </CardContent>
    </Card>
  );
}
