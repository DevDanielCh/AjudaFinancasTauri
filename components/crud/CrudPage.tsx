"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/confirm";
import { DataTable } from "./DataTable";
import { CardList } from "./CardList";
import { CardOptionsSheet } from "./CardOptionsSheet";
import { FormDialog } from "./FormDialog";
import type { Column, MobileCorners } from "./types";
import { msg } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/use-is-mobile";
import { PullToRefresh } from "@/components/PullToRefresh";

export interface CrudConfig<T extends { id: number }, F, E> {
  title: string;
  description?: string;
  columns: Column<T>[];
  pageSize?: number;
  keepOpen?: boolean;
  load: () => Promise<T[]>;
  create: (data: F) => Promise<void>;
  update: (id: number, data: F) => Promise<void>;
  remove: (ids: number[]) => Promise<void>;
  empty: () => F;
  toInput: (row: T) => F;
  loadResources: () => Promise<E>;
  FormFields: React.ComponentType<{
    value: F;
    onChange: (v: F) => void;
    resources: E;
    error: string | null;
  }>;
  reloadKey?: unknown;
  onRowDoubleClick?: (row: T) => void;
  onView?: (row: T) => void;
  protected?: (row: T) => boolean;
  mobileCorners?: MobileCorners<T>;
  /** Classe extra aplicada a cada linha/card (ex.: opacity para inativo). */
  rowClass?: (row: T) => string;
}

type DialogState<T, F> = { mode: "create" } | { mode: "edit"; row: T; input: F };

export function CrudPage<T extends { id: number }, F, E>({ config }: { config: CrudConfig<T, F, E> }) {
  const [rows, setRows] = useState<T[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState<DialogState<T, F> | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; ids: number[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [optionsRow, setOptionsRow] = useState<T | null>(null);
  const loadingRef = useRef(false);
  const isMobile = useIsMobile();

  const pageSize = config.pageSize ?? 25;
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? rows.filter((r) => config.columns.some((c) => String(c.render(r)).toLowerCase().includes(q))) : rows),
    [rows, q, config.columns]
  );
  const hasMore = visibleCount < filtered.length;
  const pageRows = filtered.slice(0, visibleCount);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount((c) => c + pageSize);
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, pageSize]);

  const reload = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      setRows(await config.load());
      setSelected(new Set());
      setQuery("");
      setVisibleCount(pageSize);
    } catch (e) {
      toast.add({ title: msg(e), type: "error" });
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [config, pageSize]);

  useEffect(() => {
    void reload(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [reload, config.reloadKey]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const askDelete = () => {
    const ids = [...selected].filter((id) => {
      const row = rows.find((r) => r.id === id);
      return !(row && config.protected?.(row));
    });
    if (ids.length === 0) {
      toast.add({
        title: "Faturas são geradas automaticamente e não podem ser excluídas",
        type: "error",
      });
      return;
    }
    setConfirm({
      ids,
      message: ids.length === 1 ? "Excluir este registro?" : `Excluir ${ids.length} registros?`,
    });
  };

  const doDelete = async () => {
    if (!confirm) return;
    try {
      await config.remove(confirm.ids);
      toast.add({ title: "Excluído com sucesso", type: "success" });
      void reload();
    } catch (e) {
      toast.add({ title: msg(e), type: "error" });
    }
  };

  return (
    <PullToRefresh onRefresh={() => reload()}>
      <div className="flex flex-col gap-4 sm:h-[calc(100vh-1.5rem)]">
        <div className="hidden items-center justify-between sm:flex">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
            {config.description && (
              <p className="text-sm text-muted-foreground">{config.description}</p>
            )}
          </div>
          <Button variant="outline" onClick={() => void reload()} disabled={loading}>
            <RefreshCw data-icon="inline-start" />
            Atualizar
          </Button>
        </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setVisibleCount(pageSize); }}
            placeholder="Buscar..."
            aria-label={`Buscar em ${config.title}`}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setDialog({ mode: "create" })}>
          <Plus data-icon="inline-start" />
          Adicionar
        </Button>
        {!isMobile && (
          <>
            <Button
              variant="outline"
              disabled={selected.size !== 1 || (config.protected?.(rows.find((r) => r.id === [...selected][0])!) ?? false)}
              onClick={() => {
                const row = rows.find((r) => r.id === [...selected][0])!;
                setDialog({ mode: "edit", row, input: config.toInput(row) });
              }}
            >
              <Pencil data-icon="inline-start" />
              Editar
            </Button>
            {config.onView && (
              <Button
                variant="outline"
                disabled={selected.size !== 1}
                onClick={() => config.onView!(rows.find((r) => r.id === [...selected][0])!)}
              >
                <Eye data-icon="inline-start" />
                Visualizar
              </Button>
            )}
            <Button variant="destructive" disabled={selected.size === 0} onClick={askDelete}>
              <Trash2 data-icon="inline-start" />
              Excluir
            </Button>
          </>
        )}
      </div>

      <div className={cn("min-h-0 flex-1", isMobile ? "" : "overflow-auto rounded-md border")}>
        {isMobile && config.mobileCorners ? (
          <CardList
            corners={config.mobileCorners}
            rows={pageRows}
            loading={loading}
            onTap={(row) => config.onView?.(row)}
            onLongPress={(row) => setOptionsRow(row)}
            rowClass={config.rowClass}
          />
        ) : (
          <DataTable
            columns={config.columns}
            rows={pageRows}
            selected={selected}
            onToggle={toggle}
            onRowDoubleClick={config.onRowDoubleClick}
            loading={loading}
            rowClass={config.rowClass}
          />
        )}
        {hasMore && <div ref={sentinelRef} className="h-2" />}
      </div>

      <div className="text-sm text-muted-foreground">
        {filtered.length} registro{filtered.length === 1 ? "" : "s"}
        {q && ` (filtrado de ${rows.length})`}
      </div>

      {dialog && (
        <FormDialog
          config={config}
          dialog={dialog}
          onClose={() => setDialog(null)}
          onSaved={() => void reload()}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        message={confirm?.message ?? ""}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        onConfirm={() => void doDelete()}
      />

      <CardOptionsSheet
        open={!!optionsRow}
        onOpenChange={(o) => { if (!o) setOptionsRow(null); }}
        row={optionsRow}
        title={(row) => String(config.mobileCorners?.topLeft(row) ?? "")}
        canEdit={(row) => !(config.protected?.(row))}
        onView={config.onView}
        onEdit={(row) => setDialog({ mode: "edit", row, input: config.toInput(row) })}
        onDelete={(row) => {
          const ids = [row.id];
          setConfirm({
            ids,
            message: ids.length === 1 ? "Excluir este registro?" : `Excluir ${ids.length} registros?`,
          });
        }}
      />
      </div>
    </PullToRefresh>
  );
}
