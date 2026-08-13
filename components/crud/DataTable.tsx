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
import type { Column } from "./types";

const FEATURES = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

export function DataTable<T extends { id: number }>({
  columns, rows, selected, onToggle, onRowDoubleClick, loading, rowClass,
}: {
  columns: Column<T>[];
  rows: T[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onRowDoubleClick?: (row: T) => void;
  loading?: boolean;
  rowClass?: (row: T) => string;
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
        id: c.header,
        accessorKey: c.header,
        sortFn: (rowA, rowB) => {
          const a = c.sortValue ? c.sortValue(rowA.original) : c.render(rowA.original);
          const b = c.sortValue ? c.sortValue(rowB.original) : c.render(rowB.original);
          if (typeof a === "number" && typeof b === "number") return a - b;
          return String(a).toLowerCase().localeCompare(String(b).toLowerCase(), "pt-BR");
        },
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
                  onClick={() => header.column.toggleSorting()}
                >
                  <table.FlexRender header={header} />
                  {header.column.getIsSorted() === "asc" ? (
                    <ArrowUp className="size-3.5" />
                  ) : header.column.getIsSorted() === "desc" ? (
                    <ArrowDown className="size-3.5" />
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
