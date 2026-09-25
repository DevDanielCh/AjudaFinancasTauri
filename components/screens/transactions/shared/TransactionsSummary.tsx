"use client";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TransactionRow } from "@/src/OrganizacaoFinanceira/Models/transaction";

export function TransactionsSummary({ rows }: { rows: TransactionRow[] }) {
  const income = rows
    .filter((r) => r.type === 1 || r.type === 5)
    .reduce((s, r) => s + r.amount, 0);
  const expense = rows
    .filter((r) => r.type === 2 || r.type === 3 || r.type === 4)
    .reduce((s, r) => s + r.amount, 0);
  const saldo = income - expense;
  return (
    <div className="grid grid-cols-3 gap-3">
      <SummaryTile label="Receitas" value={formatMoney(income)} className="text-positive" />
      <SummaryTile label="Despesas" value={formatMoney(expense)} className="text-negative" />
      <SummaryTile
        label="Sobra"
        value={formatMoney(saldo)}
        className={saldo >= 0 ? "text-positive" : "text-negative"}
      />
    </div>
  );
}

function SummaryTile({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5 sm:px-4 sm:py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("truncate text-sm font-semibold tabular-nums sm:text-lg sm:font-bold", className)}>{value}</span>
    </Card>
  );
}