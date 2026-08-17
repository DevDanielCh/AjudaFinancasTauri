"use client";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import type { Category } from "../../Models/category";

export function CategoriaViewForm({ row }: { row: Category }) {
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
          <div className="h-4 w-4 rounded border" style={{ backgroundColor: row.color }} />
          <span className="text-sm">{row.color}</span>
        </div>
      </Field>
      {row.icon && (
        <Field>
          <FieldLabel>Ícone</FieldLabel>
          <div className="text-sm">{row.icon}</div>
        </Field>
      )}
    </FieldGroup>
  );
}
