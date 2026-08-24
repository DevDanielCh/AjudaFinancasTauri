"use client";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MonthPicker } from "@/components/MonthPicker";
import { DatePicker } from "@/components/DatePicker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { FieldErrors } from "@/components/forms/FieldErrors";
import { Spinner } from "@/components/ui/spinner";
import { useStore } from "@/lib/forms";
import { formatMonth } from "@/lib/format";
import type { Category } from "../../Models/category";
import type { FixedBillInput } from "../../Models/fixed-bill";
import type { PaymentMethod } from "../../Models/payment-method";
import type { CrudFormApi } from "@/lib/forms";

export interface FixedBillResources {
  categories: Category[];
  paymentMethods: PaymentMethod[];
  cardCloseDays: Record<number, number>;
  cardValidityDays: Record<number, number>;
}

export function ContaFixaAddForm({
  form,
  resources,
  serverError,
  mode,
}: {
  form: CrudFormApi<FixedBillInput>;
  resources: FixedBillResources | undefined;
  serverError: string | null;
  mode: "recurring" | "installments";
}) {
  const values = useStore(form.store, (s) => s.values);

  useEffect(() => {
    if (!resources || resources.paymentMethods.length === 0) return;
    if (!resources.paymentMethods.some((p) => p.id === values.payment_method_id)) {
      form.setFieldValue("payment_method_id", resources.paymentMethods[0].id);
    }
  }, [resources, values.payment_method_id, form]);

  if (!resources) {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }

  const cardDay = values.payment_method_id
    ? resources.cardCloseDays[values.payment_method_id]
    : undefined;
  const cardValidity = values.payment_method_id
    ? resources.cardValidityDays[values.payment_method_id]
    : undefined;
  const isCardInstallment =
    mode === "installments" &&
    !!values.payment_method_id &&
    !!cardDay &&
    !!cardValidity;

  const faturaMonth = (purchase: string, close: number) => {
    const [y, m, d] = purchase.split("-").map(Number);
    const [ny, nm] = d >= close ? (m === 12 ? [y + 1, 1] : [y, m + 1]) : [y, m];
    return formatMonth(`${ny}-${String(nm).padStart(2, "0")}`);
  };

  return (
    <FieldGroup>
      {serverError && <FieldError>{serverError}</FieldError>}
      <div className="grid *:min-w-0 grid-cols-2 gap-4">
        <form.Field name="amount">
          {(field) => (
            <Field>
              <FieldLabel required>Valor (R$)</FieldLabel>
              <MoneyInput value={field.state.value} onChange={(c) => field.handleChange(c)} />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
        {isCardInstallment ? (
          <form.Field name="purchase_date">
            {(field) => (
              <Field>
                <FieldLabel required>Data da compra</FieldLabel>
                <DatePicker
                  value={field.state.value}
                  placeholder="Data da compra"
                  onChange={(d) => { if (d) field.handleChange(d); }}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        ) : (
          <form.Field name="day">
            {(field) => (
              <Field>
                <FieldLabel required>Dia do vencimento</FieldLabel>
                <Input
                  type="number" min="1" max="31"
                  value={field.state.value || ""}
                  onChange={(e) => field.handleChange(e.target.value ? Number(e.target.value) : 0)}
                  onBlur={field.handleBlur}
                />
                {cardDay ? (
                  <p className="text-xs text-muted-foreground">Cartão: fecha dia {cardDay}</p>
                ) : null}
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        )}
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
        <form.Field name="payment_method_id">
          {(field) => (
            <Field>
              <FieldLabel required>Forma de pagamento</FieldLabel>
              <FormSelect
                value={field.state.value.toString()}
                onChange={(v) => {
                  const id = Number(v);
                  const isCard = !!resources.cardCloseDays[id] && !!resources.cardValidityDays[id];
                  field.handleChange(id);
                  if (!isCard) form.setFieldValue("purchase_date", null);
                }}
                options={resources.paymentMethods.map((p) => ({ value: p.id.toString(), label: p.name }))}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
        <form.Field name="category_id">
          {(field) => (
            <Field>
              <FieldLabel>Categoria</FieldLabel>
              <FormSelect
                value={field.state.value?.toString() ?? ""}
                onChange={(v) => field.handleChange(v ? Number(v) : null)}
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
      {!isCardInstallment && (
        <form.Field name="start_month">
          {(field) => (
            <Field>
              <FieldLabel required>Início</FieldLabel>
              <MonthPicker
                value={field.state.value}
                onChange={(m) => field.handleChange(m)}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      )}
      {mode === "installments" ? (
        <form.Field name="installments">
          {(field) => (
            <Field>
              <FieldLabel required>Quantidade de parcelas</FieldLabel>
              <Input
                type="number" min="2"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value ? Number(e.target.value) : null)}
                onBlur={field.handleBlur}
              />
              {isCardInstallment && field.state.value && cardDay && cardValidity && values.purchase_date && (
                <p className="text-xs text-muted-foreground">
                  1ª parcela na fatura de {faturaMonth(values.purchase_date, cardDay)} • fecha dia {cardDay} • vence dia {cardValidity}
                </p>
              )}
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      ) : (
        <form.Field name="end_month">
          {(field) => (
            <Field>
              <FieldLabel>Duração</FieldLabel>
              <ToggleGroup
                value={[field.state.value ? "date" : "forever"]}
                onValueChange={(v) =>
                  field.handleChange(v[0] === "date" ? values.start_month : null)
                }
              >
                <ToggleGroupItem value="forever">Indefinida</ToggleGroupItem>
                <ToggleGroupItem value="date">Até uma data</ToggleGroupItem>
              </ToggleGroup>
              {field.state.value && (
                <div className="mt-2">
                  <MonthPicker
                    value={field.state.value}
                    onChange={(m) => field.handleChange(m)}
                  />
                </div>
              )}
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      )}
    </FieldGroup>
  );
}
