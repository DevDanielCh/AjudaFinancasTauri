"use client";
import { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MonthPicker } from "@/components/MonthPicker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { FieldErrors } from "@/components/forms/FieldErrors";
import { Spinner } from "@/components/ui/spinner";
import { useStore } from "@/lib/forms";
import type { LoanInput, PaymentMethod } from "@/lib/types";
import type { CrudFormApi } from "@/lib/forms";

function deriveRate(principal: number, installment: number, n: number): number {
  if (principal <= 0 || installment <= 0 || n < 1) return 0;
  if (installment * n <= principal) return 0;
  const g = (i: number) => installment * (1 - Math.pow(1 + i, -n)) / i - principal;
  let lo = 0, hi = 0.0001;
  while (g(hi) > 0 && hi < 100) hi *= 2;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (g(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function LoanForm({
  form,
  resources,
  serverError,
}: {
  form: CrudFormApi<LoanInput>;
  resources: { paymentMethods: PaymentMethod[] } | undefined;
  serverError: string | null;
}) {
  const values = useStore(form.store, (s) => s.values);

  useEffect(() => {
    if (!resources || resources.paymentMethods.length === 0) return;
    if (!resources.paymentMethods.some((p) => p.id === values.payment_method_id)) {
      form.setFieldValue("payment_method_id", resources.paymentMethods[0].id);
    }
  }, [resources, values.payment_method_id, form]);

  const auto = useMemo(
    () => deriveRate(values.principal, values.installment, values.total_installments),
    [values.principal, values.installment, values.total_installments]
  );
  const differs = values.monthly_rate > 0 && Math.abs(values.monthly_rate - auto) > 1e-9;

  // Pré-calcula a taxa da parcela; usuário que digitou taxa própria é preservado.
  useEffect(() => {
    if (differs) return;
    if (auto > 0) form.setFieldValue("monthly_rate", auto);
  }, [auto, differs, form]);

  const rateDisplay = values.monthly_rate > 0
    ? Number((values.monthly_rate * 100).toFixed(4))
    : "";

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
            <FieldLabel>Tipo</FieldLabel>
            <ToggleGroup
              value={[String(field.state.value)]}
              onValueChange={(v) => field.handleChange(v[0] === "2" ? 2 : 1)}
            >
              <ToggleGroupItem value="1">Empréstimo</ToggleGroupItem>
              <ToggleGroupItem value="2">Financiamento</ToggleGroupItem>
            </ToggleGroup>
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <div className="grid grid-cols-2 gap-4">
        <form.Field name="principal">
          {(field) => (
            <Field>
              <FieldLabel>Valor (R$)</FieldLabel>
              <MoneyInput value={field.state.value} onChange={(c) => field.handleChange(c)} />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
        <form.Field name="installment">
          {(field) => (
            <Field>
              <FieldLabel>Valor da parcela (R$)</FieldLabel>
              <MoneyInput value={field.state.value} onChange={(c) => field.handleChange(c)} />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      </div>
      <form.Field name="total_installments">
        {(field) => (
          <Field>
            <FieldLabel>Nº de parcelas</FieldLabel>
            <Input
              type="number" min="2"
              value={field.state.value || ""}
              onChange={(e) => field.handleChange(e.target.value ? Number(e.target.value) : 0)}
              onBlur={field.handleBlur}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field name="monthly_rate">
        {(field) => (
          <Field>
            <FieldLabel>Taxa de juros mensal (%)</FieldLabel>
            <Input
              type="number" step="0.0001" min="0" inputMode="decimal"
              value={rateDisplay}
              placeholder="0,0000"
              onChange={(e) => {
                field.handleChange(e.target.value ? Number(e.target.value) / 100 : 0);
              }}
            />
            {!differs && values.monthly_rate > 0 && (
              <p className="text-xs text-muted-foreground">
                Calculada automaticamente da parcela; ajuste se souber a taxa contratada
              </p>
            )}
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
      <form.Field name="start_month">
        {(field) => (
          <Field>
            <FieldLabel>Início</FieldLabel>
            <MonthPicker
              value={field.state.value}
              onChange={(m) => field.handleChange(m)}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field name="day">
        {(field) => (
          <Field>
            <FieldLabel>Dia do vencimento</FieldLabel>
            <Input
              type="number" min="1" max="31"
              value={field.state.value || ""}
              onChange={(e) => field.handleChange(e.target.value ? Number(e.target.value) : 0)}
              onBlur={field.handleBlur}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field name="payment_method_id">
        {(field) => (
          <Field>
            <FieldLabel>Forma de pagamento</FieldLabel>
            <NativeSelect
              className="w-full"
              value={field.state.value.toString()}
              onChange={(e) => field.handleChange(Number(e.target.value))}
            >
              {resources.paymentMethods.map((p) => (
                <NativeSelectOption key={p.id} value={p.id.toString()}>{p.name}</NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
    </FieldGroup>
  );
}
