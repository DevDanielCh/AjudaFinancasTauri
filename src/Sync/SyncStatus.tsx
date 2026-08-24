"use client";
import { Cloud, CloudOff, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSyncStatus, useSyncConnected } from "@/src/shared/sync-services";

export function SyncStatusBadge({ className }: { className?: string }) {
  const { data: connected } = useSyncConnected();
  const { data: status } = useSyncStatus();

  if (connected === false || !status) return null;

  const map: Record<
    typeof status["kind"],
    { icon: typeof Cloud; label: string; className: string; animate?: boolean }
  > = {
    synced: {
      icon: Cloud,
      label: "Sincronizado",
      className: "bg-positive/10 text-positive",
    },
    syncing: {
      icon: Loader2,
      label: "Sincronizando...",
      className: "bg-primary/10 text-primary",
      animate: true,
    },
    disconnected: {
      icon: CloudOff,
      label: "Sem sync",
      className: "bg-muted text-muted-foreground",
    },
    offline: {
      icon: CloudOff,
      label: "Conectado (sem dados)",
      className: "bg-sticker-orange/15 text-sticker-orange",
    },
    error: {
      icon: AlertCircle,
      label: status.message ?? "Erro de sync",
      className: "bg-negative/10 text-negative",
    },
  };

  const s = map[status.kind];
  const Icon = s.icon;

  return (
    <Badge className={cn("gap-1.5 text-xs py-1", className, s.className)}>
      <Icon className={cn("size-3.5", s.animate && "animate-spin")} />
      {s.label}
    </Badge>
  );
}
