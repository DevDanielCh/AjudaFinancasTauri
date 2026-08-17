"use client";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import type { PaymentMethod } from "../../Models/payment-method";

export function FormaPagamentoViewForm({ row }: { row: PaymentMethod }) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Nome</FieldLabel>
        <div className="text-sm">{row.name}</div>
      </Field>
      <Field>
        <FieldLabel>Tipo</FieldLabel>
        <div className="text-sm">{row.type === 1 ? "Padrão" : "Cartão"}</div>
      </Field>
      {row.metadata && (
        <Field>
          <FieldLabel>Metadados</FieldLabel>
          <div className="text-sm">{row.metadata}</div>
        </Field>
      )}
    </FieldGroup>
  );
}
