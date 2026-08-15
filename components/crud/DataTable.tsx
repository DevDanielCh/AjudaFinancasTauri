"use client";
import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from "lucide-react";
import {
  ColumnDef,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Sort } from "@/lib/types";
import type { Column } from "./types";

const FEATURES = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

export function DataTable<T extends { id: number }>({
  columns, rows, selected, onToggle, onRowDoubleClick, loading, rowClass, sort, onSort, onRowContextMenu,
}: {
  columns: Column<T>[];
  rows: T[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onRowDoubleClick?: (row: T) => void;
  onRowContextMenu?: (row: T, e: React.MouseEvent) => void;
  loading?: boolean;
  rowClass?: (row: T) => string;
  sort?: Sort | null;
  onSort: (sort: Sort | null) => void;
}) {
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const columnDefs = React.useMemo<ColumnDef<typeof FEATURES, T, unknown>[]>(() => {
    const defs: ColumnDef<typeof FEATURES, T, unknown>[] = [
      {
        id: "select",
        enableSorting: false,
        meta: { className: "w-12" },
        header: () => (
          <Checkbox
            checked={allChecked}
            onCheckedChange={() => rows.forEach((r) => onToggle(r.id))}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selected.has(row.original.id)}
            onCheckedChange={() => onToggle(row.original.id)}
          />
        ),
      },
    ];
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
    return defs;
  }, [columns, rows, selected, onToggle, allChecked]);

  const table = useTable({ features: FEATURES, data: rows, columns: columnDefs });
  const visibleRows = table.getRowModel().rows;

  if (rows.length === 0) {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Spinner className="size-6" />
        </div>
      );
    }
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
          <EmptyTitle>Nenhum registro</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {table.getFlatHeaders().map((header) => (
            <TableHead
              key={header.id}
              className={cn(
                header.column.getCanSort() && "cursor-pointer select-none",
                (header.column.columnDef.meta as { className?: string } | undefined)?.className
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
            onClick={() => onToggle(row.original.id)}
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
