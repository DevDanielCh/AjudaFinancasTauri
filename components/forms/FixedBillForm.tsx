"use client";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MonthPicker } from "@/components/MonthPicker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { formatMonth } from "@/lib/format";
import type { Category, FixedBillInput, PaymentMethod } from "@/lib/types";

export interface FixedBillResources {
  categories: Category[];
  paymentMethods: PaymentMethod[];
  cardCloseDays: Record<number, number>;
  cardValidityDays: Record<number, number>;
}

export function FixedBillForm({
  value, onChange, resources, error, mode,
}: {
  value: FixedBillInput;
  onChange: (v: FixedBillInput) => void;
  resources: FixedBillResources;
  error: string | null;
  mode: "recurring" | "installments";
}) {
  const cardDay = value.payment_method_id
    ? resources.cardCloseDays[value.payment_method_id]
    : undefined;
  const cardValidity = value.payment_method_id
    ? resources.cardValidityDays[value.payment_method_id]
    : undefined;

  const isCardInstallment =
    mode === "installments" &&
    !!value.payment_method_id &&
    !!cardDay &&
    !!cardValidity;

  const faturaMonth = (purchase: string, close: number) => {
    const [y, m, d] = purchase.split("-").map(Number);
    const [ny, nm] = d >= close ? (m === 12 ? [y + 1, 1] : [y, m + 1]) : [y, m];
    return formatMonth(`${ny}-${String(nm).padStart(2, "0")}`);
  };

  const pms = resources.paymentMethods;
  useEffect(() => {
    if (pms.length > 0 && !pms.some((p) => p.id === value.payment_method_id)) {
      onChange({ ...value, payment_method_id: pms[0].id });
    }
  }, [pms, value, onChange]);

  return (
    <FieldGroup>
      <FieldError>{error}</FieldError>
      <Field>
        <FieldLabel>Valor (R$)</FieldLabel>
        <MoneyInput value={value.amount} onChange={(c) => onChange({ ...value, amount: c })} />
      </Field>
      <Field>
        <FieldLabel>Descrição</FieldLabel>
        <Input value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel>Forma de pagamento</FieldLabel>
        <NativeSelect
          className="w-full"
          value={value.payment_method_id.toString()}
          onChange={(e) => {
            const id = Number(e.target.value);
            const isCard = !!resources.cardCloseDays[id] && !!resources.cardValidityDays[id];
            onChange({ ...value, payment_method_id: id, purchase_date: isCard ? value.purchase_date : null });
          }}
        >
          {resources.paymentMethods.map((p) => (
            <NativeSelectOption key={p.id} value={p.id.toString()}>{p.name}</NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {isCardInstallment ? (
        <Field>
          <FieldLabel>Data da compra</FieldLabel>
          <Input
            type="date"
            value={value.purchase_date ?? ""}
            onChange={(e) => onChange({ ...value, purchase_date: e.target.value || null })}
          />
          {value.purchase_date && cardDay && cardValidity && (
            <p className="text-xs text-muted-foreground">
              1ª parcela na fatura de {faturaMonth(value.purchase_date, cardDay)} • fecha dia {cardDay} • vence dia {cardValidity}
            </p>
          )}
        </Field>
      ) : (
        <>
          <Field>
            <FieldLabel>Início</FieldLabel>
            <MonthPicker value={value.start_month} onChange={(m) => onChange({ ...value, start_month: m })} />
          </Field>
          <Field>
            <FieldLabel>Dia do vencimento</FieldLabel>
            <Input type="number" min="1" max="31" value={value.day || ""}
              onChange={(e) => onChange({ ...value, day: Number(e.target.value) })} />
            {cardDay ? (
              <p className="text-xs text-muted-foreground">Cartão: dia de fechamento {cardDay}</p>
            ) : null}
          </Field>
        </>
      )}
      <Field>
        <FieldLabel>Categoria</FieldLabel>
        <NativeSelect
          className="w-full"
          value={value.category_id?.toString() ?? ""}
          onChange={(e) => onChange({ ...value, category_id: e.target.value ? Number(e.target.value) : null })}
        >
          <NativeSelectOption value="">Sem categoria</NativeSelectOption>
          {resources.categories.map((c) => (
            <NativeSelectOption key={c.id} value={c.id.toString()}>{c.name}</NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {mode === "installments" ? (
        <Field>
          <FieldLabel>Quantidade de parcelas</FieldLabel>
          <Input type="number" min="2" value={value.installments ?? ""}
            onChange={(e) => onChange({ ...value, installments: e.target.value ? Number(e.target.value) : null })} />
        </Field>
      ) : (
        <Field>
          <FieldLabel>Duração</FieldLabel>
          <ToggleGroup
            value={[value.end_month ? "date" : "forever"]}
            onValueChange={(v) => onChange({ ...value, end_month: v[0] === "date" ? value.start_month : null })}
          >
            <ToggleGroupItem value="forever">Indefinida</ToggleGroupItem>
            <ToggleGroupItem value="date">Até uma data</ToggleGroupItem>
          </ToggleGroup>
          {value.end_month && (
            <div className="mt-2">
              <MonthPicker value={value.end_month} onChange={(m) => onChange({ ...value, end_month: m })} />
            </div>
          )}
        </Field>
      )}
    </FieldGroup>
  );
}
