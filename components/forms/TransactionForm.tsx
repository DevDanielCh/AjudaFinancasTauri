"use client";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { DatePicker } from "@/components/DatePicker";
import { FieldErrors } from "@/components/forms/FieldErrors";
import { Spinner } from "@/components/ui/spinner";
import type { Category, PaymentMethod, TransactionInput } from "@/lib/types";
import type { CrudFormApi } from "@/lib/forms";

export function TransactionForm({
  form,
  resources,
  serverError,
}: {
  form: CrudFormApi<TransactionInput>;
  resources: { categories: Category[]; paymentMethods: PaymentMethod[] } | undefined;
  serverError: string | null;
}) {
  const selectedPm = resources?.paymentMethods.find((p) => p.id === form.state.values.payment_method_id);
  const isCard = form.state.values.type === 2 && selectedPm?.type === 2;

  if (!resources) {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }

  return (
    <FieldGroup>
      {serverError && <FieldError>{serverError}</FieldError>}
      <form.Field name="amount">
        {(field) => (
          <Field>
            <FieldLabel>Valor (R$)</FieldLabel>
            <MoneyInput value={field.state.value} onChange={(c) => field.handleChange(c)} />
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field name="description">
        {(field) => (
          <Field>
            <FieldLabel>Descrição</FieldLabel>
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
            <FieldLabel>Tipo</FieldLabel>
            <ToggleGroup
              value={[String(field.state.value)]}
              onValueChange={(v) => {
                const type = v[0] === "2" ? 2 : 1;
                field.handleChange(type);
                if (type === 1) form.setFieldValue("card_mode", 0);
              }}
            >
              <ToggleGroupItem value="1">Receita</ToggleGroupItem>
              <ToggleGroupItem value="2">Despesa</ToggleGroupItem>
            </ToggleGroup>
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field name="date">
        {(field) => (
          <Field>
            <FieldLabel>Data</FieldLabel>
            <DatePicker
              value={field.state.value}
              placeholder="Data da transação"
              onChange={(d) => { if (d) field.handleChange(d); }}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      {form.state.values.type === 2 && (
        <form.Field name="payment_method_id">
          {(field) => (
            <Field>
              <FieldLabel>Forma de pagamento</FieldLabel>
              <NativeSelect
                className="w-full"
                value={field.state.value?.toString() ?? ""}
                onChange={(e) => {
                  const pmId = e.target.value ? Number(e.target.value) : null;
                  const pm = resources.paymentMethods.find((p) => p.id === pmId);
                  field.handleChange(pmId);
                  if (pm?.type !== 2) form.setFieldValue("card_mode", 0);
                }}
              >
                <NativeSelectOption value="">
                  {form.state.values.type === 2 ? "Obrigatória para despesa" : "Opcional"}
                </NativeSelectOption>
                {resources.paymentMethods.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id.toString()}>{p.name}</NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      )}
      {isCard && (
        <form.Field name="card_mode">
          {(field) => (
            <Field>
              <FieldLabel>Modo</FieldLabel>
              <ToggleGroup
                value={[String(field.state.value)]}
                onValueChange={(v) => field.handleChange(v[0] === "1" ? 1 : 0)}
              >
                <ToggleGroupItem value="0">Crédito</ToggleGroupItem>
                <ToggleGroupItem value="1">Débito</ToggleGroupItem>
              </ToggleGroup>
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      )}
      <form.Field name="category_id">
        {(field) => (
          <Field>
            <FieldLabel>Categoria</FieldLabel>
            <NativeSelect
              className="w-full"
              value={field.state.value?.toString() ?? ""}
              onChange={(e) => field.handleChange(e.target.value ? Number(e.target.value) : null)}
            >
              <NativeSelectOption value="">Sem categoria</NativeSelectOption>
              {resources.categories.map((c) => (
                <NativeSelectOption key={c.id} value={c.id.toString()}>{c.name}</NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
    </FieldGroup>
  );
}
