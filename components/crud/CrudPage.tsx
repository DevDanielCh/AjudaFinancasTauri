"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm";
import { DataTable } from "./DataTable";
import { FormDialog } from "./FormDialog";
import type { Column } from "./types";
import { msg } from "@/lib/api";

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
}

type DialogState<T, F> = { mode: "create" } | { mode: "edit"; row: T; input: F };

export function CrudPage<T extends { id: number }, F, E>({ config }: { config: CrudConfig<T, F, E> }) {
  const [rows, setRows] = useState<T[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState<DialogState<T, F> | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; ids: number[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const pageSize = config.pageSize ?? 25;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await config.load());
      setSelected(new Set());
      setPage(1);
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setLoading(false);
    }
  }, [config]);

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
    const ids = [...selected];
    setConfirm({
      ids,
      message: ids.length === 1 ? "Excluir este registro?" : `Excluir ${ids.length} registros?`,
    });
  };

  const doDelete = async () => {
    if (!confirm) return;
    try {
      await config.remove(confirm.ids);
      toast.success("Excluído com sucesso");
      void reload();
    } catch (e) {
      toast.error(msg(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
          {config.description && (
            <p className="text-sm text-muted-foreground">{config.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void reload()} disabled={loading}>
            Atualizar
          </Button>
          <Button
            variant="outline"
            disabled={selected.size !== 1}
            onClick={() => {
              const row = rows.find((r) => r.id === [...selected][0])!;
              setDialog({ mode: "edit", row, input: config.toInput(row) });
            }}
          >
            Editar
          </Button>
          <Button variant="destructive" disabled={selected.size === 0} onClick={askDelete}>
            Excluir
          </Button>
          <Button onClick={() => setDialog({ mode: "create" })}>Adicionar</Button>
        </div>
      </div>

      <DataTable
        columns={config.columns}
        rows={pageRows}
        selected={selected}
        onToggle={toggle}
        onRowDoubleClick={config.onRowDoubleClick}
      />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {rows.length} registro{rows.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span>
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
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
    </div>
  );
}
