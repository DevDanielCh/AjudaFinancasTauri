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
import { msg } from "@/lib/api";

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
        await relaunch();
      }
    } catch (e) {
      setDoing(false);
      toast.add({ title: msg(e), type: "error" });
    }
  };

  const body = (
    <>
      <DialogHeader>
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
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={!!available} onOpenChange={(o) => { if (!o) setAvailable(null); }}>
      <DialogContent>
        {body}
      </DialogContent>
    </Dialog>
  );
}
