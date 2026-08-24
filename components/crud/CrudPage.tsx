"use client";
import { useCallback } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Search } from "lucide-react";
import type { ZodType } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/confirm";
import { Skeleton } from "boneyard-js/react";
import { DataTable } from "./DataTable";
import { CardList } from "./CardList";
import { CardOptionsSheet } from "./CardOptionsSheet";
import { RowActionsMenu } from "./RowActionsMenu";
import { FormDialog } from "./FormDialog";
import { ViewDialog } from "./ViewDialog";
import type { Column, MobileCorners } from "./types";
import type { Sort } from "@/src/shared/models";
import type { CrudFormApi } from "@/lib/forms";
import { msg } from "@/src/shared/repository";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/use-is-mobile";
import { PullToRefresh } from "@/components/PullToRefresh";

export interface CrudConfig<T extends { id: number }, F, E> {
  title: string;
  columns: Column<T>[];
  pageSize?: number;
  /** Rótulo do botão principal de criação (padrão: "Adicionar"). */
  addLabel?: string;
  /** Título do modal de criação (padrão: "Novo {title sem plural}"). */
  newTitle?: string;
  /** Título do modal de edição (padrão: "Editar {title sem plural}"). */
  editTitle?: string;
  keepOpen?: boolean;
  load: (sort: Sort | null) => Promise<T[]>;
  create: (data: F) => Promise<void>;
  update: (id: number, data: F) => Promise<void>;
  remove: (ids: number[]) => Promise<void>;
  empty: () => F;
  toInput: (row: T) => F;
  loadResources?: () => Promise<E>;
  FormFields: React.ComponentType<{
    form: CrudFormApi<F>;
    resources: E | undefined;
    serverError: string | null;
  }>;
  /** Componente de leitura usado no duplo clique da linha (modo "visualizar"). */
  ViewFields?: React.ComponentType<{ row: T }>;
  onRowDoubleClick?: (row: T) => void;
  onView?: (row: T) => void;
  protected?: (row: T) => boolean;
  /** Conteúdo exibido entre o título e a busca (ex.: card de saldo). */
  summary?: (rows: T[]) => React.ReactNode;
  mobileCorners?: MobileCorners<T>;
  /** Classe extra aplicada a cada linha/card (ex.: opacity para inativo). */
  rowClass?: (row: T) => string;
  /** Chave do react-query para esta página. */
  queryKey: readonly unknown[];
  /** Outras queries a invalidar após criar/editar/excluir. */
  invalidate?: readonly (readonly unknown[])[];
  /** Validação zod dos formulários (Standard Schema). */
  schema: ZodType<F>;
}

export type DialogState<T, F> =
  | { mode: "create"; input?: F }
  | { mode: "edit"; row: T; input: F }
  | { mode: "view"; row: T };

export function CrudPage<T extends { id: number }, F, E>({ config, autoCreate }: { config: CrudConfig<T, F, E>; autoCreate?: boolean }) {
  const client = useQueryClient();
  const [dialog, setDialog] = useState<DialogState<T, F> | null>(autoCreate ? { mode: "create" } : null);
  const [confirm, setConfirm] = useState<{ message: string; ids: number[] } | null>(null);
  const [query, setQuery] = useState("");
  const [optionsRow, setOptionsRow] = useState<T | null>(null);
  const [menu, setMenu] = useState<{ row: T; x: number; y: number } | null>(null);
  const isMobile = useIsMobile();

  const pageSize = config.pageSize ?? 25;
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [sort, setSort] = useState<Sort | null>(null);
  const effectiveKey = useMemo(() => [...config.queryKey, sort], [config.queryKey, sort]);

  const rowsQuery = useQuery({
    queryKey: effectiveKey,
    queryFn: () => config.load(sort),
    staleTime: 15_000,
    placeholderData: sort ? keepPreviousData : undefined,
  });
  const rows = useMemo(() => rowsQuery.data ?? [], [rowsQuery.data]);
  const loading = rowsQuery.isFetching;

  const invalidate = useCallback(() => {
    void client.invalidateQueries({ queryKey: effectiveKey, exact: true });
    for (const key of config.invalidate ?? []) {
      void client.invalidateQueries({ queryKey: key });
    }
  }, [client, effectiveKey, config.invalidate]);

  const refresh = useCallback(async () => {
    setQuery("");
    setVisibleCount(pageSize);
    const res = await rowsQuery.refetch();
    if (res.error) toast.add({ title: msg(res.error), type: "error" });
  }, [pageSize, rowsQuery]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? rows.filter((r) =>
            config.columns.some((c) => String(c.render(r)).toLowerCase().includes(q))
          )
        : rows,
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

  const handleSort = (next: Sort | null) => {
    setSort(next);
    setVisibleCount(pageSize);
  };

  const handleRowContextMenu = (row: T, e: MouseEvent) => {
    const canEdit = !config.protected?.(row);
    if (config.onView || canEdit) setMenu({ row, x: e.clientX, y: e.clientY });
  };

  const removeMutation = useMutation({
    mutationFn: (ids: number[]) => config.remove(ids),
    onSuccess: () => {
      setConfirm(null);
      toast.add({ title: "Excluído com sucesso", type: "success" });
      invalidate();
    },
    onError: (e) => toast.add({ title: msg(e), type: "error" }),
  });

  if (rowsQuery.isError && !rowsQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-muted-foreground">Falha ao carregar os dados</p>
        <Button variant="outline" onClick={() => rowsQuery.refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={() => refresh()}>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {config.summary?.(rows)}

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
          {!isMobile && (
            <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw data-icon="inline-start" className={cn(loading && "animate-spin")} />
              Atualizar
            </Button>
          )}
          <Button className="rounded-md" onClick={() => setDialog({ mode: "create" })}>
            <Plus data-icon="inline-start" />
            {config.addLabel ?? "Adicionar"}
          </Button>
        </div>

        <div>
          <Skeleton
            name="crud-list"
            loading={loading && rows.length === 0}
            fixture={<CrudListFixture />}
          >
            {isMobile && config.mobileCorners ? (
              <CardList
                corners={config.mobileCorners}
                rows={pageRows}
                onTap={(row) => config.onView?.(row)}
                onLongPress={(row) => setOptionsRow(row)}
                rowClass={config.rowClass}
              />
            ) : (
              <DataTable
                columns={config.columns}
                rows={pageRows}
                onRowDoubleClick={
                  config.onRowDoubleClick ??
                  ((row) => {
                    if (!config.protected?.(row)) {
                      setDialog({ mode: "edit", row, input: config.toInput(row) });
                    } else if (config.onView) {
                      config.onView(row);
                    } else if (config.ViewFields) {
                      setDialog({ mode: "view", row });
                    }
                  })
                }
                headerRight={
                  <span className="whitespace-nowrap">
                    {filtered.length} registro{filtered.length === 1 ? "" : "s"}
                    {q && ` (filtrado de ${rows.length})`}
                  </span>
                }
                rowClass={config.rowClass}
                sort={sort}
                onSort={handleSort}
                onRowContextMenu={handleRowContextMenu}
                canEditRow={(row) => !config.protected?.(row)}
                onViewRow={config.onView}
                onEditRow={(row) => setDialog({ mode: "edit", row, input: config.toInput(row) })}
                onDuplicateRow={(row) => setDialog({ mode: "create", input: config.toInput(row) })}
                onDeleteRow={(row) =>
                  setConfirm({ ids: [row.id], message: "Excluir este registro?" })
                }
              />
            )}
          </Skeleton>
          {hasMore && <div ref={sentinelRef} className="h-2" />}
        </div>

        {dialog && dialog.mode !== "view" && (
          <FormDialog
            key={dialog.mode === "edit" ? dialog.row.id : "create"}
            config={config}
            dialog={dialog}
            onClose={() => setDialog(null)}
          />
        )}

        {dialog?.mode === "view" && (
          <ViewDialog
            key={dialog.row.id}
            config={config}
            row={dialog.row}
            onClose={() => setDialog(null)}
          />
        )}

        <ConfirmDialog
          open={!!confirm}
          message={confirm?.message ?? ""}
          onOpenChange={(o) => { if (!o) setConfirm(null); }}
          onConfirm={() => confirm && removeMutation.mutate(confirm.ids)}
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

        <RowActionsMenu
          open={!!menu}
          onOpenChange={(o) => { if (!o) setMenu(null); }}
          row={menu?.row ?? null}
          x={menu?.x ?? 0}
          y={menu?.y ?? 0}
          canEdit={(row) => !(config.protected?.(row))}
          onView={config.onView}
          onEdit={(row) => setDialog({ mode: "edit", row, input: config.toInput(row) })}
          onDelete={(row) =>
            setConfirm({ ids: [row.id], message: "Excluir este registro?" })
          }
        />
      </div>
    </PullToRefresh>
  );
}

/**
 * Fixture renderizado apenas durante `npx boneyard-js build` para capturar
 * a estrutura da lista em cada breakpoint (tabela no desktop, cards no mobile).
 */
function CrudListFixture() {
  return (
    <div>
      <div className="hidden sm:block">
        <div className="flex items-center gap-4 border-b px-3 py-2.5">
          <div className="size-3.5 rounded-[4px] border" />
          {["Data", "Tipo", "Descrição", "Categoria", "Valor"].map((h) => (
            <span key={h} className="text-sm font-medium text-muted-foreground">{h}</span>
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-3 py-2.5">
            <div className="size-3.5 shrink-0 rounded-[4px] border" />
            <div className="h-4 w-20 rounded-sm bg-muted" />
            <div className="h-4 w-14 rounded-sm bg-muted" />
            <div className="h-4 flex-1 rounded-sm bg-muted" />
            <div className="h-4 w-24 rounded-sm bg-muted" />
            <div className="h-4 w-20 rounded-sm bg-muted" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 p-2 sm:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-3 select-none">
            <div className="flex items-center justify-between gap-2">
              <div className="h-4 w-40 rounded-sm bg-muted" />
              <div className="h-4 w-16 rounded-sm bg-muted" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="h-3.5 w-24 rounded-sm bg-muted" />
              <div className="h-3.5 w-20 rounded-sm bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
