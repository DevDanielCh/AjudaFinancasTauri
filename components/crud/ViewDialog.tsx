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
import type { CrudConfig } from "./CrudPage";

/** Singular genérico: remove apenas o "s" final (título irregular vem via config). */
function singular(title: string): string {
  return title.endsWith("s") ? title.slice(0, -1) : title;
}

export function ViewDialog<T extends { id: number }, F, E>({
  config,
  row,
  onClose,
}: {
  config: CrudConfig<T, F, E>;
  row: T;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const ViewFields = config.ViewFields;
  if (!ViewFields) return null;

  const actions = (
    <Button type="button" variant="outline" onClick={onClose}>
      Fechar
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent>
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
