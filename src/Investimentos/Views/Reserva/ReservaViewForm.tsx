"use client";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { formatDate, formatMoney } from "@/lib/format";
import type { ReservaRow } from "../../Models/reserva";

export function ReservaViewForm({ row }: { row: ReservaRow }) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Descrição</FieldLabel>
        <div className="text-sm">{row.description}</div>
      </Field>
      <Field>
        <FieldLabel>Valor</FieldLabel>
        <div className="text-sm font-semibold tabular-nums">{formatMoney(row.amount)}</div>
      </Field>
      <Field>
        <FieldLabel>Tipo</FieldLabel>
        <div className="text-sm">{row.type === 4 ? "Adicionar à reserva" : "Remover da reserva"}</div>
      </Field>
      <Field>
        <FieldLabel>Data</FieldLabel>
        <div className="text-sm">{formatDate(row.date)}</div>
      </Field>
      <Field>
        <FieldLabel>Movimenta a conta principal</FieldLabel>
        <div className="text-sm">{row.in_principal === false ? "Não — só a reserva" : "Sim"}</div>
      </Field>
    </FieldGroup>
  );
}
