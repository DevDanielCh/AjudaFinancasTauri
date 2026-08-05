"use client";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { DatePicker } from "@/components/DatePicker";
import type { Category, PaymentMethod, TransactionInput } from "@/lib/types";

export function TransactionForm({
  value, onChange, resources, error,
}: {
  value: TransactionInput;
  onChange: (v: TransactionInput) => void;
  resources: { categories: Category[]; paymentMethods: PaymentMethod[] };
  error: string | null;
}) {
  return (
    <FieldGroup>
      <FieldError>{error}</FieldError>
      <Field>
        <FieldLabel>Valor (R$)</FieldLabel>
        <MoneyInput value={value.amount} onChange={(c) => onChange({ ...value, amount: c })} />
      </Field>
      <Field>
        <FieldLabel>Descrição</FieldLabel>
        <Input value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel>Tipo</FieldLabel>
        <ToggleGroup
          value={[String(value.type)]}
          onValueChange={(v) => onChange({ ...value, type: v[0] === "2" ? 2 : 1 })}
        >
          <ToggleGroupItem value="1">Receita</ToggleGroupItem>
          <ToggleGroupItem value="2">Despesa</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <Field>
        <FieldLabel>Data</FieldLabel>
        <DatePicker
          value={value.date}
          placeholder="Data da transação"
          onChange={(d) => { if (d) onChange({ ...value, date: d }); }}
        />
      </Field>
      {value.type === 2 && (
        <Field>
          <FieldLabel>Forma de pagamento</FieldLabel>
          <NativeSelect
            className="w-full"
            value={value.payment_method_id?.toString() ?? ""}
            onChange={(e) => onChange({ ...value, payment_method_id: e.target.value ? Number(e.target.value) : null })}
          >
            <NativeSelectOption value="">
              {value.type === 2 ? "Obrigatória para despesa" : "Opcional"}
            </NativeSelectOption>
            {resources.paymentMethods.map((p) => (
              <NativeSelectOption key={p.id} value={p.id.toString()}>{p.name}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      )}
      <Field>
        <FieldLabel>Categoria</FieldLabel>
        <NativeSelect
          className="w-full"
          value={value.category_id?.toString() ?? ""}
          onChange={(e) => onChange({ ...value, category_id: e.target.value ? Number(e.target.value) : null })}
        >
          <NativeSelectOption value="">Sem categoria</NativeSelectOption>
          {resources.categories.map((c) => (
            <NativeSelectOption key={c.id} value={c.id.toString()}>{c.name}</NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </FieldGroup>
  );
}
