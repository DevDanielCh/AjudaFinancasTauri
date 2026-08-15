"use client";
import { useEffect } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RowActionsMenu<T extends { id: number }>({
  open, onOpenChange, row, x, y, canEdit, onView, onEdit, onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: T | null;
  x: number;
  y: number;
  canEdit: (row: T) => boolean;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const close = () => onOpenChange(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, onOpenChange]);

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger
        nativeButton={false}
        render={<span key={`${row?.id}:${x}:${y}`} style={{ position: "fixed", left: x, top: y }} className="pointer-events-none" />}
      />
      <DropdownMenuContent side="bottom" align="start" sideOffset={0}>
        {row && onView && (
          <DropdownMenuItem onClick={() => { onOpenChange(false); onView(row); }}>
            <Eye />
            Visualizar
          </DropdownMenuItem>
        )}
        {row && onEdit && canEdit(row) && (
          <DropdownMenuItem onClick={() => { onOpenChange(false); onEdit(row); }}>
            <Pencil />
            Editar
          </DropdownMenuItem>
        )}
        {row && onDelete && canEdit(row) && (
          <DropdownMenuItem variant="destructive" onClick={() => { onOpenChange(false); onDelete(row); }}>
            <Trash2 />
            Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
