"use client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { useDashboard } from "@/src/shared/services";

export function MonthStatusBadge({
  month,
  className,
}: {
  month: string | null;
  className?: string;
}) {
  const { data } = useDashboard(month);
  if (!data) return null;
  const balance = data.income - data.expenses;
  const metaValor = Math.round((data.income * data.meta_investimento) / 100);
  const bateuMeta = metaValor > 0 && data.aportes >= metaValor;
  const sobrou = balance > 0;
  const abs = Math.abs(balance);
  const variant = sobrou && bateuMeta ? "positive" : sobrou ? "yellow" : "negative";
  const label = sobrou ? `Sobrou ${formatMoney(abs)}` : `Faltou ${formatMoney(abs)}`;
  return (
    <Badge
      className={cn(
        "text-xs",
        variant === "positive" && "bg-positive text-positive-foreground",
        variant === "negative" && "bg-negative text-negative-foreground",
        variant === "yellow" && "bg-sticker-orange text-white",
        className,
      )}
    >
      {label}
    </Badge>
  );
}
