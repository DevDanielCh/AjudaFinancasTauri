"use client";
import { useRef } from "react";
import { Inbox, Lock, SearchX } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { MobileCorners } from "./types";

export function CardList<T extends { id: number }>({
  corners, rows, onTap, onLongPress, rowClass, emptySearch, protectedRow,
}: {
  corners: MobileCorners<T>;
  rows: T[];
  onTap?: (row: T) => void;
  onLongPress?: (row: T) => void;
  rowClass?: (row: T) => string;
  /** True quando há busca ativa e não há resultado (distingue de lista vazia). */
  emptySearch?: boolean;
  /** Marca rows protegidas exibindo o ícone de bloqueio (faturas, reserva). */
  protectedRow?: (row: T) => boolean;
}) {
  const suppressClick = useRef(false);
  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">{emptySearch ? <SearchX /> : <Inbox />}</EmptyMedia>
          <EmptyTitle>{emptySearch ? "Nenhum resultado para a busca" : "Nenhum registro"}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            className={cn("w-full cursor-pointer select-none rounded-xl border border-border/50 bg-card p-2.5 text-left transition-colors active:bg-accent", rowClass?.(row))}
            onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onTap?.(row); }}
            onPointerDown={(e) => {
              suppressClick.current = false;
              const sx = e.clientX;
              const sy = e.clientY;
              const t = setTimeout(() => { suppressClick.current = true; onLongPress?.(row); }, 500);
              const cancel = () => { clearTimeout(t); };
              const onUp = () => { cancel(); cleanup(); };
              const onMove = (ev: PointerEvent) => {
                if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 10) return;
                cancel();
                cleanup();
              };
              const cleanup = () => {
                window.removeEventListener("pointerup", onUp);
                window.removeEventListener("pointercancel", onMove);
                window.removeEventListener("pointermove", onMove);
              };
              window.addEventListener("pointerup", onUp);
              window.addEventListener("pointercancel", onMove);
              window.addEventListener("pointermove", onMove);
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="min-w-0 truncate text-sm font-medium">{corners.topLeft(row)}</span>
                  {protectedRow?.(row) && (
                    <Lock className="size-3 shrink-0 text-muted-foreground/60" aria-label="Registro protegido" />
                  )}
                </div>
                {corners.bottomLeft && (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {corners.bottomLeft(row)}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                {corners.topRight && (
                  <div className="truncate text-sm font-semibold tabular-nums">
                    {corners.topRight(row)}
                  </div>
                )}
                {corners.bottomRight && (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {corners.bottomRight(row)}
                  </div>
                )}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
