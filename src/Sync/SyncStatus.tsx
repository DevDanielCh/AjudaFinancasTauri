"use client";
import { Cloud, CloudOff, Loader2, AlertCircle, CloudUpload, CloudDownload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSyncStatus, useSyncConnected, syncKeys } from "@/src/shared/sync-services";

export function SyncStatusBadge() {
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
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    syncing: {
      icon: Loader2,
      label: "Sincronizando...",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
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
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    },
    error: {
      icon: AlertCircle,
      label: status.message ?? "Erro de sync",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
  };

  const s = map[status.kind];
  const Icon = s.icon;

  return (
    <Badge className={cn("w-full gap-1.5 text-xs py-1", s.className)}>
      <Icon className={cn("size-3.5", s.animate && "animate-spin")} />
      {s.label}
    </Badge>
  );
}
