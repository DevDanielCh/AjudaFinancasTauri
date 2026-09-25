"use client";
import { useEffect, useMemo } from "react";
import { Banknote, Building2, FileText, HandCoins, Percent, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FormSelect } from "@/components/forms/FormSelect";
import { TypeSelector } from "@/components/forms/TypeSelector";
import { MonthPicker } from "@/components/MonthPicker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { StepperInput } from "@/components/forms/StepperInput";
import { FormSection } from "@/components/forms/FormSection";
import { FieldErrors } from "@/components/forms/FieldErrors";
import { Spinner } from "@/components/ui/spinner";
import { useStore } from "@/lib/forms";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LoanInput } from "../../Models/loan";
import type { PaymentMethod } from "../../Models/payment-method";
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

export function FinanciamentoAddForm({
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

  useEffect(() => {
    if (differs) return;
    if (auto > 0) form.setFieldValue("monthly_rate", auto);
  }, [auto, differs, form]);

  const rateDisplay = values.monthly_rate > 0
    ? Number((values.monthly_rate * 100).toFixed(4))
    : "";

  const totalPagar = values.installment * values.total_installments;
  const jurosTotais = totalPagar - values.principal;
  const showResumo =
    values.principal > 0 &&
    values.installment > 0 &&
    values.total_installments >= 2 &&
    totalPagar >= values.principal;

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

      <FormSection title="Identificação" icon={FileText}>
        <form.Field name="type">
          {(field) => (
            <Field>
              <FieldLabel required>Tipo</FieldLabel>
              <TypeSelector
                options={[
                  { value: "1", label: "Empréstimo", icon: HandCoins, tone: "primary" },
                  { value: "2", label: "Financiamento", icon: Building2, tone: "primary" },
                ]}
                value={String(field.state.value)}
                onChange={(v) => field.handleChange(Number(v) as LoanInput["type"])}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
        <form.Field name="description">
          {(field) => (
            <Field>
              <FieldLabel required>Descrição</FieldLabel>
              <Input
                size="lg"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="ex.: Empréstimo consignado, financiamento do carro."
              />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      </FormSection>

      <FormSection title="Valores" icon={Banknote}>
        <div className="grid *:min-w-0 grid-cols-2 items-start gap-4">
          <form.Field name="principal">
            {(field) => (
              <Field>
                <FieldLabel required>Valor total (R$)</FieldLabel>
                <MoneyInput size="lg" value={field.state.value} onChange={(c) => field.handleChange(c)} />
                <FieldDescription>Valor contratado no empréstimo.</FieldDescription>
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="installment">
            {(field) => (
              <Field>
                <FieldLabel required>Valor da parcela (R$)</FieldLabel>
                <MoneyInput size="lg" value={field.state.value} onChange={(c) => field.handleChange(c)} />
                <FieldDescription>Pago em cada parcela mensal.</FieldDescription>
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </div>
      </FormSection>

      <FormSection title="Parcelas e juros" icon={Percent}>
        <div className="grid *:min-w-0 grid-cols-2 items-start gap-4">
          <form.Field name="total_installments">
            {(field) => (
              <Field>
                <FieldLabel required>Nº de parcelas</FieldLabel>
                <StepperInput
                  value={field.state.value}
                  min={2}
                  max={999}
                  onChange={(v) => field.handleChange(v)}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="monthly_rate">
            {(field) => (
              <Field>
                <FieldLabel required>Taxa mensal (%)</FieldLabel>
                <Input
                  size="lg"
                  type="number" step="0.0001" min="0" inputMode="decimal"
                  value={rateDisplay}
                  placeholder="0,0000"
                  onChange={(e) => {
                    field.handleChange(e.target.value ? Number(e.target.value) / 100 : 0);
                  }}
                />
                <FieldDescription>
                  {!differs && values.monthly_rate > 0
                    ? "Calculada automaticamente da parcela."
                    : "Deixe em 0 para calcular da parcela."}
                </FieldDescription>
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </div>
      </FormSection>

      <FormSection title="Pagamento" icon={Wallet}>
        <div className="grid *:min-w-0 gap-4 sm:grid-cols-3">
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
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="payment_method_id">
            {(field) => (
              <Field>
                <FieldLabel required>Forma de pagamento</FieldLabel>
                <FormSelect
                  size="lg"
                  value={field.state.value.toString()}
                  onChange={(v) => field.handleChange(Number(v))}
                  options={resources.paymentMethods.map((p) => ({ value: p.id.toString(), label: p.name }))}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </div>
      </FormSection>

      {showResumo && (
        <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total a pagar</span>
            <span className="font-semibold tabular-nums">{formatMoney(totalPagar)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Juros totais</span>
            <span className={cn("font-semibold tabular-nums", jurosTotais > 0 ? "text-negative" : "text-positive")}>
              {formatMoney(jurosTotais)}
            </span>
          </div>
          {values.monthly_rate > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Taxa mensal</span>
              <span className="font-semibold tabular-nums">{rateDisplay}%</span>
            </div>
          )}
        </div>
      )}
    </FieldGroup>
  );
}