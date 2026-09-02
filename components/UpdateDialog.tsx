"use client";
import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useIsMobile } from "@/lib/use-is-mobile";
import { msg } from "@/src/shared/repository";

export function UpdateDialog() {
  const isMobile = useIsMobile();
  const [available, setAvailable] = useState<null | { version: string }>(null);
  const [doing, setDoing] = useState(false);

  useEffect(() => {
    check()
      .then((u) => { if (u?.available) setAvailable({ version: u.version }); })
      .catch(() => {});
  }, []);

  const apply = async () => {
    setDoing(true);
    try {
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall();
        setAvailable(null);
        try {
          await relaunch();
        } catch {
          // Atualização já gravada em disco; só não conseguiu reiniciar sozinho.
          toast.add({
            title: "Atualização instalada. Feche e abra o aplicativo para concluir.",
            type: "success",
          });
        }
      }
    } catch (e) {
      setDoing(false);
      const raw = msg(e);
      const isPermission =
        /permission denied/i.test(raw) ||
        /permiss/i.test(raw) ||
        /os error 13/i.test(raw);
      toast.add(
        isPermission
          ? {
              title:
                "Sem permissão para atualizar. Mova o AppImage para uma pasta do seu usuário (ex.: ~/Aplicativos) e abra o app de lá.",
              type: "error",
            }
          : { title: raw, type: "error" }
      );
    }
  };

  const renderBody = (showHeaderClose: boolean) => (
    <>
      <DialogHeader showCloseButton={showHeaderClose}>
        <DialogTitle>Nova versão disponível</DialogTitle>
        <DialogDescription>
          Versão {available?.version} disponível. Atualizar agora?
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => setAvailable(null)}>Agora não</Button>
        <Button onClick={() => void apply()} disabled={doing}>
          {doing ? "Baixando..." : "Atualizar e reiniciar"}
        </Button>
      </DialogFooter>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={!!available} onOpenChange={(o) => { if (!o) setAvailable(null); }}>
        <SheetContent side="bottom" showCloseButton>
          <div className="px-4">{renderBody(false)}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={!!available} onOpenChange={(o) => { if (!o) setAvailable(null); }}>
      <DialogContent>
        {renderBody(true)}
      </DialogContent>
    </Dialog>
  );
}
