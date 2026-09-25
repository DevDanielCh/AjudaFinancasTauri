"use client";
import { useEffect } from "react";
import { CalendarRange, CreditCard, ReceiptText, Repeat, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MonthPicker } from "@/components/MonthPicker";
import { DatePicker } from "@/components/DatePicker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { StepperInput } from "@/components/forms/StepperInput";
import { FormSection } from "@/components/forms/FormSection";
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

  const showSummary =
    isCardInstallment &&
    values.installments != null &&
    values.installments >= 2 &&
    !!values.purchase_date;

  return (
    <FieldGroup>
      {serverError && <FieldError>{serverError}</FieldError>}

      <FormSection title="Identificação" icon={ReceiptText}>
        <form.Field name="description">
          {(field) => (
            <Field>
              <FieldLabel required>Descrição</FieldLabel>
              <Input
                size="lg"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="ex.: Aluguel, Academia, Netflix…"
              />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      </FormSection>

      <FormSection
        title={isCardInstallment ? "Compra no cartão" : "Vencimento"}
        icon={isCardInstallment ? CreditCard : CalendarRange}
      >
        <div className="grid *:min-w-0 grid-cols-2 items-start gap-4">
          <form.Field name="amount">
            {(field) => (
              <Field>
                <FieldLabel required>Valor (R$)</FieldLabel>
                <MoneyInput
                  size="lg"
                  value={field.state.value}
                  onChange={(c) => field.handleChange(c)}
                />
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
                    size="lg"
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
                  <StepperInput
                    value={field.state.value}
                    min={1}
                    max={31}
                    onChange={(v) => field.handleChange(v)}
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
      </FormSection>

      <FormSection title="Pagamento" icon={Wallet}>
        <div className="grid *:min-w-0 grid-cols-2 items-start gap-4">
          <form.Field name="payment_method_id">
            {(field) => (
              <Field>
                <FieldLabel required>Forma de pagamento</FieldLabel>
                <FormSelect
                  size="lg"
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
                  size="lg"
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
      </FormSection>

      {mode === "installments" ? (
        <FormSection title="Parcelas" icon={Repeat}>
          <form.Field name="installments">
            {(field) => (
              <Field>
                <FieldLabel required>Quantidade de parcelas</FieldLabel>
                <StepperInput
                  value={field.state.value ?? 0}
                  min={2}
                  max={120}
                  onChange={(v) => field.handleChange(v >= 2 ? v : null)}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          {showSummary && cardDay && cardValidity && values.purchase_date && (
            <div className="flex flex-col gap-0.5 rounded-lg border bg-muted/40 p-3 text-sm">
              <span className="font-medium">
                1ª parcela na fatura de {faturaMonth(values.purchase_date, cardDay)}
              </span>
              <span className="text-muted-foreground">
                Fecha dia {cardDay} • vence dia {cardValidity}
              </span>
            </div>
          )}
        </FormSection>
      ) : (
        <FormSection title="Duração" icon={Repeat}>
          <form.Field name="start_month">
            {(field) => (
              <Field>
                <FieldLabel required>Início</FieldLabel>
                <MonthPicker
                  size="lg"
                  value={field.state.value}
                  onChange={(m) => field.handleChange(m)}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="end_month">
            {(field) => (
              <Field>
                <FieldLabel>Duração</FieldLabel>
                <ToggleGroup
                  className="h-10"
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
                      size="lg"
                      value={field.state.value}
                      onChange={(m) => field.handleChange(m)}
                    />
                  </div>
                )}
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FormSection>
      )}
    </FieldGroup>
  );
}