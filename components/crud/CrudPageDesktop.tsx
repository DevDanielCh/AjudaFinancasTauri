"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterX, Plus, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrudConfig } from "./types";
import { useCrudPage } from "./use-crud-page";
import { DataTable } from "./DataTable";
import { RowActionsMenu } from "./RowActionsMenu";
import { FormDialog } from "./FormDialog";
import { ViewDialog } from "./ViewDialog";
import { ConfirmDialog } from "@/components/confirm";

export function CrudPageDesktop<T extends { id: number }, F, E>({
  config,
  autoCreate,
}: {
  config: CrudConfig<T, F, E>;
  autoCreate?: boolean;
}) {
  const {
    dialog,
    setDialog,
    confirm,
    setConfirm,
    query,
    setQuery,
    menu,
    setMenu,
    filterDefs,
    filters,
    hasActiveFilters,
    handleSetFilter,
    pageSize,
    setVisibleCount,
    sort,
    handleSort,
    derivedOptionsMap,
    rows,
    loading,
    filtered,
    pageRows,
    hasMore,
    setSentinel,
    invalidate,
    refresh,
    clearFilters,
    handleRowContextMenu,
    removeMutation,
    dataError,
    dataRefetch,
  } = useCrudPage(config, autoCreate);

  if (dataError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-muted-foreground">Falha ao carregar os dados</p>
        <Button variant="outline" onClick={() => void dataRefetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {config.summary?.(rows)}

      <div className="flex flex-wrap items-center gap-2">
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
        <Button
          variant="outline"
          disabled={!query.trim() && !sort && !hasActiveFilters}
          onClick={clearFilters}
        >
          <FilterX data-icon="inline-start" />
          Limpar Filtros
        </Button>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw data-icon="inline-start" className={cn(loading && "animate-spin")} />
          Atualizar
        </Button>
        <Button className="rounded-md" onClick={() => setDialog({ mode: "create" })}>
          <Plus data-icon="inline-start" />
          {config.addLabel ?? "Adicionar"}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <DataTable
          columns={config.columns}
          rows={pageRows}
          emptySearch={(!!query.trim() || hasActiveFilters) && filtered.length === 0}
          tableClassName={config.tableClassName}
          filterDefs={filterDefs}
          activeFilters={filters}
          onSetFilter={handleSetFilter}
          derivedOptions={derivedOptionsMap}
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
              {(query.trim() || hasActiveFilters) && ` (filtrado de ${rows.length})`}
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
        {hasMore && <div ref={setSentinel} className="h-2" />}
      </div>

      {dialog && dialog.mode !== "view" && (
        <FormDialog
          key={dialog.mode === "edit" ? dialog.row.id : "create"}
          config={config}
          dialog={dialog}
          variant="dialog"
          onClose={() => setDialog(null)}
          onSaved={() => {
            invalidate();
            config.onSaved?.();
          }}
        />
      )}

      {dialog?.mode === "view" && (
        <ViewDialog
          key={dialog.row.id}
          config={config}
          row={dialog.row}
          variant="dialog"
          onClose={() => setDialog(null)}
        />
      )}

      <ConfirmDialog
        variant="dialog"
        open={!!confirm}
        message={confirm?.message ?? ""}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        onConfirm={() => confirm && removeMutation.mutate(confirm.ids)}
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
  );
}