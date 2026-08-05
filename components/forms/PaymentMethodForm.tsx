"use client";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PaymentMethodInput } from "@/lib/types";

export function PaymentMethodForm({
  value, onChange, error,
}: {
  value: PaymentMethodInput;
  onChange: (v: PaymentMethodInput) => void;
  resources: Record<string, never>;
  error: string | null;
}) {
  const isCard = value.type === 2;
  return (
    <FieldGroup>
      <FieldError>{error}</FieldError>
      <Field>
        <FieldLabel>Nome</FieldLabel>
        <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel>Tipo</FieldLabel>
        <ToggleGroup
          value={[String(value.type)]}
          onValueChange={(v) => {
            const t = v[0] === "2" ? 2 : 1;
            onChange({ ...value, type: t, ...(t === 1 ? { close_day: null, validity_day: null } : {}) });
          }}
        >
          <ToggleGroupItem value="1">Padrão</ToggleGroupItem>
          <ToggleGroupItem value="2">Cartão</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      {isCard && (
        <>
          <Field>
            <FieldLabel>Dia de fechamento</FieldLabel>
            <Input type="number" min="1" max="31" value={value.close_day ?? ""}
              onChange={(e) => onChange({ ...value, close_day: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field>
            <FieldLabel>Dia de vencimento</FieldLabel>
            <Input type="number" min="1" max="31" value={value.validity_day ?? ""}
              onChange={(e) => onChange({ ...value, validity_day: e.target.value ? Number(e.target.value) : null })} />
          </Field>
        </>
      )}
    </FieldGroup>
  );
}
