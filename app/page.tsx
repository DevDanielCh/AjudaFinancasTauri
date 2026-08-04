"use client";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useMonth } from "@/lib/month-context";
import { api, msg } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { DashboardData } from "@/lib/types";

export default function DashboardPage() {
  const { month } = useMonth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async (withSync: boolean) => {
    try {
      setData(withSync ? await api.syncDashboard(month) : await api.getDashboard(month));
    } catch (e) {
      toast.error(msg(e));
    }
  }, [month]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(false); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Button variant="outline" size="sm" disabled={syncing} onClick={() => { setSyncing(true); void load(true).finally(() => setSyncing(false)); }}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Sincronizar
        </Button>
      </div>

      {!data ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Receitas" value={formatMoney(data.income)} positive />
            <StatCard label="Despesas" value={formatMoney(data.expenses)} negative />
            <StatCard label="Saldo do mês" value={formatMoney(data.income - data.expenses)}
              positive={data.income - data.expenses >= 0} />
            <StatCard label="Saldo acumulado" value={formatMoney(data.balance)}
              positive={data.balance >= 0} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Receitas por categoria</CardTitle></CardHeader>
              <CardContent>
                {data.income_by_cat.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem receitas</p>
                ) : (
                  <ul className="space-y-2">
                    {data.income_by_cat.map((b) => (
                      <li key={b.name} className="flex items-center justify-between text-sm">
                        <span>{b.name}</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{formatMoney(b.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Despesas por forma de pagamento</CardTitle></CardHeader>
              <CardContent>
                {data.expenses_by_pm.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem despesas</p>
                ) : (
                  <ul className="space-y-2">
                    {data.expenses_by_pm.map((b) => (
                      <li key={b.name} className="flex items-center justify-between text-sm">
                        <span>{b.name}</span>
                        <span className="text-rose-600 dark:text-rose-400">{formatMoney(b.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  const cls = positive ? "text-emerald-600 dark:text-emerald-400"
    : negative ? "text-rose-600 dark:text-rose-400" : "";
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle></CardHeader>
      <CardContent><div className={cls + " text-2xl font-bold"}>{value}</div></CardContent>
    </Card>
  );
}
