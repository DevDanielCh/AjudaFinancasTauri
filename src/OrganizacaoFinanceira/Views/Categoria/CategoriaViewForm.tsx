"use client";
import { createElement } from "react";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { getCategoryIcon } from "./icons";
import type { Category } from "../../Models/category";

export function CategoriaViewForm({ row }: { row: Category }) {
  const Icon = getCategoryIcon(row.icon);
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Nome</FieldLabel>
        <div className="text-sm">{row.name}</div>
      </Field>
      <Field>
        <FieldLabel>Tipo</FieldLabel>
        <div className="text-sm">{row.type === 1 ? "Receita" : "Despesa"}</div>
      </Field>
      <Field>
        <FieldLabel>Cor</FieldLabel>
        <div className="flex items-center gap-2">
          <span
            className="inline-block size-4 rounded-full border border-black/10"
            style={{ backgroundColor: row.color }}
          />
          <span className="font-mono text-xs text-muted-foreground">{row.color}</span>
        </div>
      </Field>
      <Field>
        <FieldLabel>Ícone</FieldLabel>
        <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-input bg-transparent">
          {Icon ? (
            createElement(Icon, { className: "size-4 text-muted-foreground" })
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </Field>
    </FieldGroup>
  );
}
