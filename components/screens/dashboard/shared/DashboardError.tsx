"use client";
import { Button } from "@/components/ui/button";

export function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-muted-foreground">Falha ao carregar o dashboard</p>
      <Button variant="outline" onClick={onRetry}>Tentar novamente</Button>
    </div>
  );
}