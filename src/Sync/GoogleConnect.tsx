"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { useSyncDisconnect, useSyncConnected, useSyncAuto, syncKeys } from "@/src/shared/sync-services";
import { syncApi } from "@/src/shared/sync-repository";
import { msg } from "@/src/shared/repository";

export function GoogleConnect() {
  const { data: connected, isLoading } = useSyncConnected();
  const disconnect = useSyncDisconnect();
  const autoSync = useSyncAuto();
  const [waitingCallback, setWaitingCallback] = useState(false);
  const queryClient = useQueryClient();

  if (isLoading) return <Spinner />;

  if (connected) {
    return (
      <Button
        variant="outline"
        onClick={() =>
          disconnect.mutate(undefined, {
            onSuccess: () =>
              toast.add({ title: "Google desconectado", type: "success" }),
            onError: (e) =>
              toast.add({ title: msg(e), type: "error" }),
          })
        }
        disabled={disconnect.isPending}
      >
        {disconnect.isPending && <Spinner data-icon="inline-start" />}
        Desconectar Google
      </Button>
    );
  }

  async function handleConnect() {
    try {
      const url = await syncApi.startAuth();
      setWaitingCallback(true);
      await syncApi.openUrl(url);

      const result = await syncApi.completeAuth();
      setWaitingCallback(false);
      toast.add({ title: result, type: "success" });
      void queryClient.invalidateQueries({ queryKey: syncKeys.connected });
      void queryClient.invalidateQueries({ queryKey: syncKeys.status });

      autoSync.mutate(undefined, {
        onSuccess: (m) => toast.add({ title: m, type: "success" }),
        onError: (e) => toast.add({ title: msg(e), type: "error" }),
      });
    } catch (e) {
      setWaitingCallback(false);
      toast.add({ title: msg(e), type: "error" });
    }
  }

  return (
    <Button onClick={handleConnect} disabled={waitingCallback}>
      {waitingCallback && <Spinner data-icon="inline-start" />}
      {waitingCallback ? "Aguardando login no navegador..." : "Conectar Google"}
    </Button>
  );
}
