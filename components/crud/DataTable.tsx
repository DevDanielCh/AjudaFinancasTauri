"use client";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Column } from "./types";

export function DataTable<T extends { id: number }>({
  columns, rows, selected, onToggle, onRowDoubleClick,
}: {
  columns: Column<T>[];
  rows: T[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onRowDoubleClick?: (row: T) => void;
}) {
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
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={columns.length + 1} className="h-24 text-center text-muted-foreground">
              Nenhum registro
            </TableCell>
          </TableRow>
        )}
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
              <TableCell key={c.header} className={c.className}>{c.render(row)}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
