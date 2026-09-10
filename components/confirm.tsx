"use client";
import { useIsMobile } from "@/lib/use-is-mobile";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open, message, onOpenChange, onConfirm, variant,
}: { open: boolean; message: string; onOpenChange: (o: boolean) => void; onConfirm: () => void; variant?: "sheet" | "dialog" }) {
  const isMobile = useIsMobile();
  const variant_ = variant ?? (isMobile ? "sheet" : "dialog");

  if (variant_ === "sheet") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-3 pb-6">
          <SheetHeader>
            <SheetTitle>Confirmar exclusão</SheetTitle>
            <SheetDescription>{message}</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>
              Excluir
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
<DialogHeader showSeparator={false}>
          <DialogTitle>Confirmar exclusão</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
