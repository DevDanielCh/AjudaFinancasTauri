"use client";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FormSelect } from "@/components/forms/FormSelect";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { DatePicker } from "@/components/DatePicker";
import { FieldErrors } from "@/components/forms/FieldErrors";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/forms";
import type { Category } from "../../Models/category";
import type { PaymentMethod } from "../../Models/payment-method";
import type { TransactionInput } from "../../Models/transaction";
import type { CrudFormApi } from "@/lib/forms";

export function TransacaoAddForm({
  form,
  resources,
  serverError,
}: {
  form: CrudFormApi<TransactionInput>;
  resources: { categories: Category[]; paymentMethods: PaymentMethod[] } | undefined;
  serverError: string | null;
}) {
  const values = useStore(form.store, (s) => s.values);
  const selectedPm = resources?.paymentMethods.find((p) => p.id === values.payment_method_id);
  const isCard = values.type === 2 && selectedPm?.type === 2;

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
      <form.Field name="type">
        {(field) => (
          <Field>
            <FieldLabel required>Tipo</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  field.handleChange(1);
                  form.setFieldValue("card_mode", 0);
                }}
                className={cn(
                  "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors",
                  field.state.value === 1
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "border-input bg-transparent text-muted-foreground hover:bg-muted"
                )}
              >
                <ArrowUpCircle className="size-4" /> Receita
              </button>
              <button
                type="button"
                onClick={() => field.handleChange(2)}
                className={cn(
                  "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors",
                  field.state.value === 2
                    ? "border-red-500 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
                    : "border-input bg-transparent text-muted-foreground hover:bg-muted"
                )}
              >
                <ArrowDownCircle className="size-4" /> Despesa
              </button>
            </div>
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <div className="grid *:min-w-0 grid-cols-2 gap-4">
        <form.Field name="amount">
          {(field) => (
            <Field>
              <FieldLabel required>Valor (R$)</FieldLabel>
              <MoneyInput
                className="h-11 text-lg font-semibold"
                value={field.state.value}
                onChange={(c) => field.handleChange(c)}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
        <form.Field name="date">
          {(field) => (
            <Field>
              <FieldLabel required>Data</FieldLabel>
              <DatePicker
                className="h-11"
                value={field.state.value}
                placeholder="Data"
                onChange={(d) => { if (d) field.handleChange(d); }}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      </div>
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
      <div className="grid *:min-w-0 grid-cols-2 gap-4">
        {values.type === 2 && (
          <form.Field name="payment_method_id">
            {(field) => (
              <Field>
                <FieldLabel required>Forma de pagamento</FieldLabel>
                <FormSelect
                  value={field.state.value?.toString() ?? ""}
                  onChange={(v) => {
                    const pmId = v ? Number(v) : null;
                    const pm = resources.paymentMethods.find((p) => p.id === pmId);
                    field.handleChange(pmId);
                    if (pm?.type !== 2) form.setFieldValue("card_mode", 0);
                  }}
                  options={[
                    { value: "", label: "Obrigatória para despesa" },
                    ...resources.paymentMethods.map((p) => ({ value: p.id.toString(), label: p.name })),
                  ]}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        )}
        <form.Field name="category_id">
          {(field) => (
            <Field className={values.type === 2 ? undefined : "col-span-2"}>
              <FieldLabel>Categoria</FieldLabel>
              <FormSelect
                value={field.state.value?.toString() ?? ""}
                onChange={(v) => {
                  const catId = v ? Number(v) : null;
                  field.handleChange(catId);
                  const cat = resources.categories.find((c) => c.id === catId);
                  if (cat && !values.description.trim()) {
                    form.setFieldValue("description", cat.name);
                  }
                }}
                options={[
                  { value: "", label: "Sem categoria" },
                  ...resources.categories.map((c) => ({ value: c.id.toString(), label: c.name })),
                ]}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      </div>
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
    </FieldGroup>
  );
}
