"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { msg } from "@/src/shared/repository";
import {
  useSyncNow,
  useSyncAuto,
  useSyncSetPassphrase,
  useSyncConnected,
  useSyncStatus,
} from "@/src/shared/sync-services";
import { GoogleConnect } from "./GoogleConnect";
import { SyncStatusBadge } from "./SyncStatus";

export function SyncSettings() {
  const { data: connected } = useSyncConnected();
  const { data: status } = useSyncStatus();
  const syncNow = useSyncNow();
  const autoSync = useSyncAuto();
  const setPassphrase = useSyncSetPassphrase();
  const [passphrase, setPassphraseValue] = useState("");

  const handleSyncNow = () =>
    syncNow.mutate(undefined, {
      onSuccess: (m) => toast.add({ title: m, type: "success" }),
      onError: (e) => toast.add({ title: msg(e), type: "error" }),
    });

  const handleAutoSync = () =>
    autoSync.mutate(undefined, {
      onSuccess: (m) => toast.add({ title: m, type: "success" }),
      onError: (e) => toast.add({ title: msg(e), type: "error" }),
    });

  const handleSetPassphrase = () => {
    if (!passphrase.trim()) return;
    setPassphrase.mutate(passphrase, {
      onSuccess: () => {
        toast.add({ title: "Senha definida", type: "success" });
        setPassphraseValue("");
      },
      onError: (e) => toast.add({ title: msg(e), type: "error" }),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sincronização</CardTitle>
        <CardDescription>
          Sincronize seus dados entre dispositivos via Google Drive.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="flex flex-col gap-2">
            <GoogleConnect />
            <SyncStatusBadge />
          </div>

          {connected && (
            <>
              <Field>
                <FieldLabel>Senha de criptografia</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Senha para proteger dados"
                    value={passphrase}
                    onChange={(e) => setPassphraseValue(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    onClick={handleSetPassphrase}
                    disabled={setPassphrase.isPending || !passphrase.trim()}
                  >
                    {setPassphrase.isPending ? <Spinner /> : "Definir"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Protege seus dados com criptografia antes de enviar ao Drive.
                </p>
              </Field>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={handleSyncNow}
                  disabled={
                    syncNow.isPending ||
                    status?.kind === "syncing"
                  }
                  className="flex-1"
                >
                  {syncNow.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : null}
                  Sincronizar agora
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAutoSync}
                  disabled={
                    autoSync.isPending ||
                    status?.kind === "syncing"
                  }
                  className="flex-1"
                >
                  {autoSync.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : null}
                  Sincronizar com Drive
                </Button>
              </div>
            </>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
