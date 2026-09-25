"use client";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TransactionRow } from "@/src/OrganizacaoFinanceira/Models/transaction";

export function ReservaBalance({ rows, seed }: { rows: TransactionRow[]; seed: number }) {
  const saldo = seed + rows.reduce((acc, r) => acc + (r.type === 5 ? -r.amount : r.amount), 0);
  return (
    <Card className="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
      <span className="truncate text-sm text-muted-foreground">Saldo da reserva</span>
      <span className={cn("truncate text-base font-semibold tabular-nums sm:text-lg", saldo < 0 ? "text-negative" : "text-positive")}>
        {formatMoney(saldo)}
      </span>
    </Card>
  );
}