"use client";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TransactionRow } from "@/src/OrganizacaoFinanceira/Models/transaction";

export function ReservaBalance({ rows, seed }: { rows: TransactionRow[]; seed: number }) {
  const saldo = seed + rows.reduce((acc, r) => acc + (r.type === 5 ? -r.amount : r.amount), 0);
  return (
    <Card className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">Saldo da reserva</span>
      <span className={cn("text-lg font-semibold tabular-nums", saldo < 0 ? "text-negative" : "text-positive")}>
        {formatMoney(saldo)}
      </span>
    </Card>
  );
}