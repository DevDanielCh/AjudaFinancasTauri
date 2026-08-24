"use client";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { DatePicker } from "@/components/DatePicker";
import { FieldErrors } from "@/components/forms/FieldErrors";
import type { ReservaInput } from "../../Models/reserva";
import type { CrudFormApi } from "@/lib/forms";

export function ReservaAddForm({
  form,
  serverError,
}: {
  form: CrudFormApi<ReservaInput>;
  resources: undefined;
  serverError: string | null;
}) {
  return (
    <FieldGroup>
      {serverError && <FieldError>{serverError}</FieldError>}
      <form.Field name="amount">
        {(field) => (
          <Field>
            <FieldLabel required>Valor (R$)</FieldLabel>
            <MoneyInput value={field.state.value} onChange={(c) => field.handleChange(c)} />
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field name="description">
        {(field) => (
          <Field>
            <FieldLabel required>Descrição</FieldLabel>
            <Input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field name="type">
        {(field) => (
          <Field>
            <FieldLabel required>Tipo</FieldLabel>
            <ToggleGroup
              value={[String(field.state.value)]}
              onValueChange={(v) => field.handleChange(v[0] === "5" ? 5 : 4)}
            >
              <ToggleGroupItem value="4">Adicionar à reserva</ToggleGroupItem>
              <ToggleGroupItem value="5">Remover da reserva</ToggleGroupItem>
            </ToggleGroup>
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field name="date">
        {(field) => (
          <Field>
            <FieldLabel required>Data</FieldLabel>
            <DatePicker
              value={field.state.value}
              placeholder="Data da movimentação"
              onChange={(d) => { if (d) field.handleChange(d); }}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
    </FieldGroup>
  );
}
