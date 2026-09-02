"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useMonth } from "@/lib/month-context";
import { Skeleton } from "boneyard-js/react";
import { msg } from "@/src/shared/repository";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDashboard, useChartData, useSyncDashboard } from "@/src/shared/services";
import type { ChartData, DashboardData } from "@/src/shared/models";
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
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex items-center justify-end">
          <Button variant="outline" disabled={dashboardQuery.isFetching} onClick={() => void doSync()}
            className="hidden sm:inline-flex">
            <RefreshCw data-icon="inline-start" className={cn(dashboardQuery.isFetching && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        <Skeleton
          name="dashboard"
          loading={!data}
          fixture={<DashboardContent month={month} data={DASHBOARD_FIXTURE} chart={CHART_FIXTURE} />}
        >
          {data && <DashboardContent month={month} data={data} chart={chartQuery.data} />}
        </Skeleton>
      </div>
    </PullToRefresh>
  );
}

function DashboardContent({
  month, data, chart,
}: {
  month: string;
  data: DashboardData;
  chart: ChartData | undefined;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Receitas" value={formatMoney(data.income)} positive
          className="border-positive/25 bg-positive/5">
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
        <StatCard label="Despesas" value={formatMoney(data.expenses)} negative
          className="border-negative/25 bg-negative/5">
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
        <StatCard label="Saldo acumulado" value={formatMoney(data.balance)} hero />
      </div>
      {data.meta_investimento > 0 && (
        <MetaCard pct={data.meta_investimento} income={data.income} aportes={data.aportes} />
      )}
      {chart && <ChartSection data={chart} month={month} />}
    </div>
  );
}

const DASHBOARD_FIXTURE: DashboardData = {
  month: "2026-01",
  income: 8500,
  expenses: 4320.75,
  balance: 15230.4,
  prev_balance: 11050.15,
  meta_investimento: 20,
  aportes: 1700,
  income_by_cat: [
    { name: "Salário", total: 7000 },
    { name: "Freelance", total: 1500 },
  ],
  expenses_by_pm: [
    { name: "Cartão de crédito", total: 2450.5 },
    { name: "Pix", total: 1120.25 },
    { name: "Débito", total: 750 },
  ],
};

const CHART_FIXTURE: ChartData = {
  monthly: Array.from({ length: 6 }, (_, i) => ({
    month: `2025-${String(i + 8).padStart(2, "0")}`,
    income: 8000 + i * 250,
    expenses: 4000 + i * 120,
    balance: 9000 + i * 900,
    reserva: 1000 + i * 300,
  })),
  expenses_by_cat: [
    { name: "Moradia", total: 1800 },
    { name: "Alimentação", total: 950 },
    { name: "Transporte", total: 480 },
    { name: "Lazer", total: 320 },
  ],
  expenses_by_pm: [
    { name: "Cartão de crédito", total: 2450 },
    { name: "Pix", total: 800 },
    { name: "Débito", total: 300 },
  ],
};

function StatCard({
  label, value, positive, negative, hero, className, children,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
  hero?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const cls = hero ? "text-primary"
    : positive ? "text-positive"
    : negative ? "text-negative" : "";
  return (
    <Card
      className={cn(
        hero && "border-primary/25 bg-primary/10",
        !hero && className,
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold tabular-nums", cls)}>{value}</div>
        {children}
      </CardContent>
    </Card>
  );
}

function MetaCard({ pct, income, aportes }: { pct: number; income: number; aportes: number }) {
  const metaValor = Math.round((income * pct) / 100);
  const atingiu = metaValor > 0 && aportes >= metaValor;
  const progresso = metaValor > 0 ? Math.min((aportes / metaValor) * 100, 100) : 0;

  return (
    <Card className="overflow-visible">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
          Meta de investimento
          <Badge variant={atingiu ? "positive" : "negative"}>
            {atingiu ? "Meta batida" : "Não bateu"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatMoney(aportes)} de {formatMoney(metaValor)}</span>
          <span className="tabular-nums">{Math.round(progresso)}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              atingiu ? "bg-positive" : "bg-primary",
            )}
            style={{ width: `${progresso}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {pct.toLocaleString("pt-BR")}% da renda
        </p>
      </CardContent>
    </Card>
  );
}
