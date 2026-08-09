"use client";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

export function CardOptionsSheet<T extends { id: number }>({
  open, onOpenChange, row, title, canEdit, onView, onEdit, onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: T | null;
  title: (row: T) => string;
  canEdit: (row: T) => boolean;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="gap-1 pb-6">
        {row && (
          <>
            <SheetTitle className="px-4 pt-2">{title(row)}</SheetTitle>
            <SheetDescription className="px-4" />
            <div className="flex flex-col px-2">
              {onView && (
                <button
                  type="button"
                  onClick={() => { onOpenChange(false); onView(row); }}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-accent"
                >
                  <Eye className="size-4" /> Visualizar
                </button>
              )}
              {onEdit && canEdit(row) && (
                <button
                  type="button"
                  onClick={() => { onOpenChange(false); onEdit(row); }}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-accent"
                >
                  <Pencil className="size-4" /> Editar
                </button>
              )}
              {onDelete && canEdit(row) && (
                <button
                  type="button"
                  onClick={() => { onOpenChange(false); onDelete(row); }}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-destructive hover:bg-accent"
                >
                  <Trash2 className="size-4" /> Excluir
                </button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
