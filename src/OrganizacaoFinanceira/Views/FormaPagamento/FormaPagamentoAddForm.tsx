"use client";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FieldErrors } from "@/components/forms/FieldErrors";
import { useStore } from "@/lib/forms";
import type { PaymentMethodInput } from "../../Models/payment-method";
import type { CrudFormApi } from "@/lib/forms";

export function FormaPagamentoAddForm({
  form,
  serverError,
}: {
  form: CrudFormApi<PaymentMethodInput>;
  serverError: string | null;
}) {
  const values = useStore(form.store, (s) => s.values);
  const isCard = values.type === 2;
  return (
    <FieldGroup>
      {serverError && <FieldError>{serverError}</FieldError>}
      <form.Field name="name">
        {(field) => (
          <Field>
            <FieldLabel required>Nome</FieldLabel>
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
              onValueChange={(v) => {
                const t = v[0] === "2" ? 2 : 1;
                field.handleChange(t);
                if (t === 1) {
                  form.setFieldValue("close_day", null);
                  form.setFieldValue("validity_day", null);
                }
              }}
            >
              <ToggleGroupItem value="1">Padrão</ToggleGroupItem>
              <ToggleGroupItem value="2">Cartão</ToggleGroupItem>
            </ToggleGroup>
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      {isCard && (
        <>
          <form.Field name="close_day">
            {(field) => (
              <Field>
                <FieldLabel required>Dia de fechamento</FieldLabel>
                <Input
                  type="number" min="1" max="31"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value ? Number(e.target.value) : null)}
                  onBlur={field.handleBlur}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="validity_day">
            {(field) => (
              <Field>
                <FieldLabel required>Dia de vencimento</FieldLabel>
                <Input
                  type="number" min="1" max="31"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value ? Number(e.target.value) : null)}
                  onBlur={field.handleBlur}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </>
      )}
    </FieldGroup>
  );
}
