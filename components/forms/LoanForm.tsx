"use client";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MonthPicker } from "@/components/MonthPicker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import type { LoanInput, PaymentMethod } from "@/lib/types";

export function LoanForm({
  value, onChange, resources, error,
}: {
  value: LoanInput;
  onChange: (v: LoanInput) => void;
  resources: { paymentMethods: PaymentMethod[] };
  error: string | null;
}) {
  const pms = resources.paymentMethods;
  useEffect(() => {
    if (pms.length > 0 && !pms.some((p) => p.id === value.payment_method_id)) {
      onChange({ ...value, payment_method_id: pms[0].id });
    }
  }, [pms, value, onChange]);

  return (
    <FieldGroup>
      <FieldError>{error}</FieldError>
      <Field>
        <FieldLabel>Tipo</FieldLabel>
        <ToggleGroup
          value={[String(value.type)]}
          onValueChange={(v) => onChange({ ...value, type: v[0] === "2" ? 2 : 1 })}
        >
          <ToggleGroupItem value="1">Empréstimo</ToggleGroupItem>
          <ToggleGroupItem value="2">Financiamento</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel>Valor (R$)</FieldLabel>
          <MoneyInput value={value.principal} onChange={(c) => onChange({ ...value, principal: c })} />
        </Field>
        <Field>
          <FieldLabel>Valor da parcela (R$)</FieldLabel>
          <MoneyInput value={value.installment} onChange={(c) => onChange({ ...value, installment: c })} />
        </Field>
      </div>
      <Field>
        <FieldLabel>Nº de parcelas</FieldLabel>
        <Input type="number" min="2" value={value.total_installments || ""}
          onChange={(e) => onChange({ ...value, total_installments: Number(e.target.value) })} />
      </Field>
      <Field>
        <FieldLabel>Descrição</FieldLabel>
        <Input value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel>Início</FieldLabel>
        <MonthPicker value={value.start_month} onChange={(m) => onChange({ ...value, start_month: m })} />
      </Field>
      <Field>
        <FieldLabel>Dia do vencimento</FieldLabel>
        <Input type="number" min="1" max="31" value={value.day || ""}
          onChange={(e) => onChange({ ...value, day: Number(e.target.value) })} />
      </Field>
      <Field>
        <FieldLabel>Forma de pagamento</FieldLabel>
        <NativeSelect
          className="w-full"
          value={value.payment_method_id.toString()}
          onChange={(e) => onChange({ ...value, payment_method_id: Number(e.target.value) })}
        >
          {resources.paymentMethods.map((p) => (
            <NativeSelectOption key={p.id} value={p.id.toString()}>{p.name}</NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {value.total_installments >= 2 && value.installment * value.total_installments < value.principal && (
        <FieldError>Total das parcelas menor que o valor</FieldError>
      )}
    </FieldGroup>
  );
}
