"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
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