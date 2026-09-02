"use client";
import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, Eye, Inbox, MoreHorizontal, Pencil, SearchX, Trash2 } from "lucide-react";
import {
  ColumnDef,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/use-is-mobile";
import type { Sort } from "@/src/shared/models";
import type { Column } from "./types";

const FEATURES = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

export function DataTable<T extends { id: number }>({
  columns, rows, onRowDoubleClick, rowClass, sort, onSort, onRowContextMenu,
  canEditRow, onViewRow, onEditRow, onDuplicateRow, onDeleteRow, headerRight,
  emptySearch, tableClassName,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowDoubleClick?: (row: T) => void;
  onRowContextMenu?: (row: T, e: React.MouseEvent) => void;
  rowClass?: (row: T) => string;
  sort?: Sort | null;
  onSort: (sort: Sort | null) => void;
  canEditRow?: (row: T) => boolean;
  onViewRow?: (row: T) => void;
  onEditRow?: (row: T) => void;
  onDuplicateRow?: (row: T) => void;
  onDeleteRow?: (row: T) => void;
  headerRight?: React.ReactNode;
  /** True quando há busca ativa e não há resultado (distingue de lista vazia). */
  emptySearch?: boolean;
  /** Classe extra aplicada ao container da tabela. */
  tableClassName?: string;
}) {
  const columnDefs = React.useMemo<ColumnDef<typeof FEATURES, T, unknown>[]>(() => {
    const defs: ColumnDef<typeof FEATURES, T, unknown>[] = [];
    for (const c of columns) {
      defs.push({
        id: c.name ?? c.label,
        header: () => c.label,
        enableSorting: !!c.name,
        accessorFn: (row) => (c.sortValue ? c.sortValue(row) : c.render(row)),
        cell: ({ row }) => c.render(row.original),
        meta: { className: c.className },
      });
    }
    defs.push({
      id: "actions",
      enableSorting: false,
      header: () => (
        <div className="flex items-center justify-end">
          {headerRight ?? <span className="sr-only">Ações</span>}
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-end">
          <RowActions
            row={row.original}
            canEdit={canEditRow?.(row.original) ?? true}
            onView={onViewRow}
            onEdit={onEditRow}
            onDuplicate={onDuplicateRow}
            onDelete={onDeleteRow}
          />
        </div>
      ),
    });
    return defs;
  }, [columns, headerRight, canEditRow, onViewRow, onEditRow, onDuplicateRow, onDeleteRow]);

  const table = useTable({ features: FEATURES, data: rows, columns: columnDefs });
  const visibleRows = table.getRowModel().rows;
  const isMobile = useIsMobile();

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
    <Table
      scrollable
      className={cn(
        tableClassName,
        isMobile && "table-scroll-mobile",
        !isMobile && "table-scroll-desktop"
      )}
    >
      <TableHeader scrollable>
        <TableRow className="[&>th]:bg-card">
          {table.getFlatHeaders().map((header) => (
            <TableHead
              key={header.id}
              scrollable
              className={cn(
                header.column.getCanSort() && "cursor-pointer select-none"
              )}
            >
              {header.column.getCanSort() ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => {
                    const cur = sort;
                    const next = !cur || cur.id !== header.id
                      ? { id: header.id, desc: false }
                      : cur.desc
                        ? null
                        : { id: header.id, desc: true };
                    onSort(next);
                  }}
                >
                  <table.FlexRender header={header} />
                  {sort?.id === header.id ? (
                    sort.desc ? (
                      <ArrowDown className="size-3.5" />
                    ) : (
                      <ArrowUp className="size-3.5" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3.5 opacity-40" />
                  )}
                </button>
              ) : (
                <table.FlexRender header={header} />
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {visibleRows.map((row) => (
          <TableRow
            key={row.original.id}
            className={cn("cursor-pointer", rowClass?.(row.original))}
            onDoubleClick={() => onRowDoubleClick?.(row.original)}
            onContextMenu={(e) => {
              if (!onRowContextMenu) return;
              e.preventDefault();
              onRowContextMenu(row.original, e);
            }}
          >
            {row.getAllCells().map((cell) => (
              <TableCell
                key={cell.id}
                className={cn(
                  "tabular-nums",
                  (cell.column.columnDef.meta as { className?: string } | undefined)?.className
                )}
              >
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RowActions<T extends { id: number }>({
  row, canEdit, onView, onEdit, onDuplicate, onDelete,
}: {
  row: T;
  canEdit: boolean;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDuplicate?: (row: T) => void;
  onDelete?: (row: T) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Ações do registro"
            title="Ações"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-popup-open:bg-accent"
          >
            <MoreHorizontal className="size-4" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-40">
        {onEdit && canEdit && (
          <DropdownMenuItem onClick={() => onEdit(row)}>
            <Pencil />
            Editar
          </DropdownMenuItem>
        )}
        {onDuplicate && canEdit && (
          <DropdownMenuItem onClick={() => onDuplicate(row)}>
            <Copy />
            Duplicar
          </DropdownMenuItem>
        )}
        {onView && (
          <DropdownMenuItem onClick={() => onView(row)}>
            <Eye />
            Visualizar
          </DropdownMenuItem>
        )}
        {onDelete && canEdit && (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(row)}>
            <Trash2 />
            Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
