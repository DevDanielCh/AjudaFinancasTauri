"use client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MetaCard({ pct, income, aportes }: { pct: number; income: number; aportes: number }) {
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