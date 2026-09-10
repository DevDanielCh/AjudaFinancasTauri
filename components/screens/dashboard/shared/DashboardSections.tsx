"use client";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/format";
import { ChartSection } from "@/components/dashboard/ChartSection";
import { RendaCard } from "@/components/dashboard/RendaCard";
import type { ChartData, DashboardData } from "@/src/shared/models";
import { StatCard } from "./StatCard";
import { MetaCard } from "./MetaCard";

export function DashboardStatsGrid({ data }: { data: DashboardData }) {
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
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
  );
}

export function DashboardSections({
  month, data, chart,
}: {
  month: string;
  data: DashboardData;
  chart: ChartData | undefined;
}) {
  return (
    <div className="flex flex-col gap-4">
      <DashboardStatsGrid data={data} />
      {data.meta_investimento > 0 && (
        <MetaCard pct={data.meta_investimento} income={data.income} aportes={data.aportes} />
      )}
      {chart && <ChartSection data={chart} month={month} />}
      <RendaCard key={data.month} income={data.income} />
    </div>
  );
}