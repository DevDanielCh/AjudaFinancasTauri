"use client";
import { Loader2 } from "lucide-react";
import { useSyncStatus } from "@/src/shared/sync-services";

export function SyncOverlay() {
  const { data: status } = useSyncStatus();

  if (status?.kind !== "syncing") return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm"
      data-slot="sync-overlay"
    >
      <Loader2 className="size-10 animate-spin text-primary" />
      <div className="flex flex-col items-center gap-1">
        <p className="text-lg font-medium">Sincronizando dados...</p>
        <p className="text-sm text-muted-foreground">
          Aguarde, o app ficará disponível em instantes.
        </p>
      </div>
    </div>
  );
}
