"use client";
import { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MonthPicker } from "@/components/MonthPicker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import type { LoanInput, PaymentMethod } from "@/lib/types";

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
  value, onChange, resources, error,
}: {
  value: LoanInput;
  onChange: (v: LoanInput) => void;
  resources: { paymentMethods: PaymentMethod[] };
  error: string | null;
}) {
  const pms = resources.paymentMethods;
  useEffect(() => {
    if (pms.length > 0 && !pms.some((p) => p.id === value.payment_method_id)) {
      onChange({ ...value, payment_method_id: pms[0].id });
    }
  }, [pms, value, onChange]);

  const auto = useMemo(
    () => deriveRate(value.principal, value.installment, value.total_installments),
    [value.principal, value.installment, value.total_installments]
  );
  const differs = value.monthly_rate > 0 && Math.abs(value.monthly_rate - auto) > 1e-9;

  // Pré-calcula a taxa da parcela; usuário que digitou taxa própria é preservado.
  useEffect(() => {
    if (differs) return;
    if (auto > 0) onChange({ ...value, monthly_rate: auto });
  }, [auto]); // eslint-disable-line react-hooks/exhaustive-deps

  const rateDisplay = value.monthly_rate > 0
    ? Number((value.monthly_rate * 100).toFixed(4))
    : "";

  return (
    <FieldGroup>
      <FieldError>{error}</FieldError>
      <Field>
        <FieldLabel>Tipo</FieldLabel>
        <ToggleGroup
          value={[String(value.type)]}
          onValueChange={(v) => onChange({ ...value, type: v[0] === "2" ? 2 : 1 })}
        >
          <ToggleGroupItem value="1">Empréstimo</ToggleGroupItem>
          <ToggleGroupItem value="2">Financiamento</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel>Valor (R$)</FieldLabel>
          <MoneyInput value={value.principal} onChange={(c) => onChange({ ...value, principal: c })} />
        </Field>
        <Field>
          <FieldLabel>Valor da parcela (R$)</FieldLabel>
          <MoneyInput value={value.installment} onChange={(c) => onChange({ ...value, installment: c })} />
        </Field>
      </div>
      <Field>
        <FieldLabel>Nº de parcelas</FieldLabel>
        <Input type="number" min="2" value={value.total_installments || ""}
          onChange={(e) => onChange({ ...value, total_installments: Number(e.target.value) })} />
      </Field>
      <Field>
        <FieldLabel>Taxa de juros mensal (%)</FieldLabel>
        <Input
          type="number" step="0.0001" min="0" inputMode="decimal"
          value={rateDisplay}
          placeholder="0,0000"
          onChange={(e) => {
            onChange({ ...value, monthly_rate: e.target.value ? Number(e.target.value) / 100 : 0 });
          }}
        />
        {!differs && value.monthly_rate > 0 && (
          <p className="text-xs text-muted-foreground">
            Calculada automaticamente da parcela; ajuste se souber a taxa contratada
          </p>
        )}
      </Field>
      <Field>
        <FieldLabel>Descrição</FieldLabel>
        <Input value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel>Início</FieldLabel>
        <MonthPicker value={value.start_month} onChange={(m) => onChange({ ...value, start_month: m })} />
      </Field>
      <Field>
        <FieldLabel>Dia do vencimento</FieldLabel>
        <Input type="number" min="1" max="31" value={value.day || ""}
          onChange={(e) => onChange({ ...value, day: Number(e.target.value) })} />
      </Field>
      <Field>
        <FieldLabel>Forma de pagamento</FieldLabel>
        <NativeSelect
          className="w-full"
          value={value.payment_method_id.toString()}
          onChange={(e) => onChange({ ...value, payment_method_id: Number(e.target.value) })}
        >
          {resources.paymentMethods.map((p) => (
            <NativeSelectOption key={p.id} value={p.id.toString()}>{p.name}</NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {value.total_installments >= 2 && value.installment * value.total_installments < value.principal && (
        <FieldError>Total das parcelas menor que o valor</FieldError>
      )}
    </FieldGroup>
  );
}
