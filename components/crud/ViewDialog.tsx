"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/lib/use-is-mobile";
import type { CrudConfig } from "./types";

/** Singular genérico: remove apenas o "s" final (título irregular vem via config). */
function singular(title: string): string {
  return title.endsWith("s") ? title.slice(0, -1) : title;
}

export function ViewDialog<T extends { id: number }, F, E>({
  config,
  row,
  onClose,
  variant,
}: {
  config: CrudConfig<T, F, E>;
  row: T;
  onClose: () => void;
  /** Plataforma alvo. Quando omisso, decide pelo breakpoint (legado). */
  variant?: "sheet" | "dialog";
}) {
  const isMobile = useIsMobile();
  const variant_ = variant ?? (isMobile ? "sheet" : "dialog");
  const ViewFields = config.ViewFields;
  if (!ViewFields) return null;

  const actions = (
    <Button type="button" variant="outline" onClick={onClose}>
      Fechar
    </Button>
  );

  if (variant_ === "sheet") {
    return (
      <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Visualizar {singular(config.title)}</SheetTitle>
          </SheetHeader>
          <ViewFields row={row} />
          <SheetFooter className="mt-6">{actions}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Visualizar {singular(config.title)}</DialogTitle>
        </DialogHeader>
        <ViewFields row={row} />
        <DialogFooter className="mt-6">{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
