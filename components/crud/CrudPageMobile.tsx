"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterX, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrudConfig } from "./types";
import { useCrudPage } from "./use-crud-page";
import { DataTable } from "./DataTable";
import { CardList } from "./CardList";
import { CardOptionsSheet } from "./CardOptionsSheet";
import { FilterBar } from "./FilterBar";
import { FilterMenu } from "./FilterMenu";
import { FormDialog } from "./FormDialog";
import { ViewDialog } from "./ViewDialog";
import { ConfirmDialog } from "@/components/confirm";
import { PullToRefresh } from "@/components/PullToRefresh";

export function CrudPageMobile<T extends { id: number }, F, E>({
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
    optionsRow,
    setOptionsRow,
    filterDefs,
    filters,
    hasActiveFilters,
    pendingIds,
    toggleAdded,
    handleSetFilter,
    pageSize,
    setVisibleCount,
    sort,
    handleSort,
    derivedOptionsMap,
    rows,
    filtered,
    pageRows,
    hasMore,
    setSentinel,
    invalidate,
    refresh,
    clearFilters,
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
    <PullToRefresh onRefresh={() => refresh()}>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {config.summary?.(rows)}

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <FilterMenu
              filters={filterDefs}
              activeFilters={filters}
              addedIds={new Set([...pendingIds, ...Object.keys(filters)])}
              onAdd={toggleAdded}
            />
            <Button
              variant="outline"
              className="flex-1"
              disabled={!query.trim() && !hasActiveFilters}
              onClick={clearFilters}
            >
              <FilterX data-icon="inline-start" />
              Limpar Filtros
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setVisibleCount(pageSize); }}
              placeholder="Buscar..."
              aria-label={`Buscar em ${config.title}`}
              className="pl-8"
            />
          </div>
        </div>

        <FilterBar
          filters={filterDefs}
          activeFilters={filters}
          pendingIds={pendingIds}
          onSetFilter={handleSetFilter}
          derivedOptions={derivedOptionsMap}
        />

        <div className={cn("flex min-h-0 flex-1 flex-col pb-16", config.mobileCorners && "h-full overflow-y-auto")}>
          {config.mobileCorners ? (
            <CardList
              corners={config.mobileCorners}
              rows={pageRows}
              onTap={(row) => config.onView?.(row)}
              onLongPress={(row) => setOptionsRow(row)}
              rowClass={config.rowClass}
              emptySearch={(!!query.trim() || hasActiveFilters) && filtered.length === 0}
            />
          ) : (
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
              headerRight={<span className="sr-only">Ações</span>}
              rowClass={config.rowClass}
              sort={sort}
              onSort={handleSort}
              canEditRow={(row) => !config.protected?.(row)}
              onViewRow={config.onView}
              onEditRow={(row) => setDialog({ mode: "edit", row, input: config.toInput(row) })}
              onDuplicateRow={(row) => setDialog({ mode: "create", input: config.toInput(row) })}
              onDeleteRow={(row) =>
                setConfirm({ ids: [row.id], message: "Excluir este registro?" })
              }
            />
          )}
          {hasMore && <div ref={setSentinel} className="h-2" />}
        </div>

        {dialog && dialog.mode !== "view" && (
          <FormDialog
            key={dialog.mode === "edit" ? dialog.row.id : "create"}
            config={config}
            dialog={dialog}
            variant="sheet"
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
            variant="sheet"
            onClose={() => setDialog(null)}
          />
        )}

        <ConfirmDialog
          variant="sheet"
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

        <Button
          size="icon"
          aria-label={config.addLabel ?? "Adicionar"}
          onClick={() => setDialog({ mode: "create" })}
          className="fixed right-4 z-40 h-14 w-14 rounded-full shadow-lg"
          style={{ bottom: "calc(7.5rem + var(--safe-area-inset-bottom))" }}
        >
          <Plus className="size-6" />
        </Button>
      </div>
    </PullToRefresh>
  );
}