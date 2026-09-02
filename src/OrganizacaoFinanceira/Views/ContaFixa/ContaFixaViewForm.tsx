"use client";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import type { FixedBill } from "../../Models/fixed-bill";

export function ContaFixaViewForm({ row }: { row: FixedBill }) {
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
        <FieldLabel>Dia do vencimento</FieldLabel>
        <div className="text-sm">{row.day}</div>
      </Field>
      <Field>
        <FieldLabel>Categoria</FieldLabel>
        <div className="text-sm">{row.category_name ?? "Sem categoria"}</div>
      </Field>
      <Field>
        <FieldLabel>Forma de pagamento</FieldLabel>
        <div className="text-sm">{row.payment_method_name}</div>
      </Field>
      <Field>
        <FieldLabel>Início</FieldLabel>
        <div className="text-sm">{row.start_month ? formatMonth(row.start_month) : "—"}</div>
      </Field>
      {row.end_month && (
        <Field>
          <FieldLabel>Fim</FieldLabel>
          <div className="text-sm">{formatMonth(row.end_month)}</div>
        </Field>
      )}
      {row.installments && (
        <Field>
          <FieldLabel>Parcelas</FieldLabel>
          <div className="text-sm">{row.installments}</div>
        </Field>
      )}
      {row.purchase_date && (
        <Field>
          <FieldLabel>Data da compra</FieldLabel>
          <div className="text-sm">{formatDate(row.purchase_date)}</div>
        </Field>
      )}
      <Field>
        <FieldLabel>Status</FieldLabel>
        <div className="text-sm">{row.finished ? "Finalizado" : "Ativo"}</div>
      </Field>
    </FieldGroup>
  );
}
