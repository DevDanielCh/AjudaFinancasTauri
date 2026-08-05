"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useMonth } from "@/lib/month-context";
import { Spinner } from "@/components/ui/spinner";
import { api, msg } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/lib/types";

export default function DashboardPage() {
  const { month } = useMonth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const load = useCallback(async (withSync: boolean) => {
    try {
      setData(withSync ? await api.syncDashboard(month) : await api.getDashboard(month));
    } catch (e) {
      toast.add({ title: msg(e), type: "error" });
    }
  }, [month]);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      setData(await api.syncDashboard(month));
      toast.add({ title: "Sincronizado com sucesso", type: "success" });
    } catch (e) {
      toast.add({ title: msg(e), type: "error" });
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [month]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(false); }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Button variant="outline" size="sm" disabled={syncing} onClick={() => void sync()}>
          <RefreshCw data-icon="inline-start" className={cn(syncing && "animate-spin")} />
          {syncing ? "Sincronizando..." : "Sincronizar"}
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
        </>
      )}
    </div>
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
