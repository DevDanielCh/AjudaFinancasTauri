"use client";
import { Inbox } from "lucide-react";
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

export function DataTable<T extends { id: number }>({
  columns, rows, selected, onToggle, onRowDoubleClick, loading,
}: {
  columns: Column<T>[];
  rows: T[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onRowDoubleClick?: (row: T) => void;
  loading?: boolean;
}) {
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
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox checked={allChecked} onCheckedChange={() => {
              rows.forEach((r) => onToggle(r.id));
            }} />
          </TableHead>
          {columns.map((c) => (
            <TableHead key={c.header} className={c.className}>{c.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            className="cursor-pointer"
            onClick={() => onToggle(row.id)}
            onDoubleClick={() => onRowDoubleClick?.(row)}
          >
            <TableCell onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={selected.has(row.id)} onCheckedChange={() => onToggle(row.id)} />
            </TableCell>
            {columns.map((c) => (
              <TableCell key={c.header} className={cn("tabular-nums", c.className)}>{c.render(row)}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
