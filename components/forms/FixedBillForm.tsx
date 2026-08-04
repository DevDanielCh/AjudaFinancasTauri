"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/forms/Select";
import { MonthPicker } from "@/components/MonthPicker";
import type { Category, FixedBillInput, PaymentMethod } from "@/lib/types";

export interface FixedBillResources {
  categories: Category[];
  paymentMethods: PaymentMethod[];
  cardCloseDays: Record<number, number>;
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
  const effectiveDay = cardDay ?? value.day;
  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Label>Descrição</Label>
        <Input value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" min="0"
            value={value.amount === 0 ? "" : (value.amount / 100).toFixed(2)}
            onChange={(e) => onChange({ ...value, amount: Math.round(Number(e.target.value) * 100) })} />
        </div>
        <div>
          <Label>Dia</Label>
          <Input type="number" min="1" max="31" value={value.day || ""}
            onChange={(e) => onChange({ ...value, day: Number(e.target.value) })} />
          {cardDay ? (
            <p className="mt-1 text-xs text-muted-foreground">Cartão: dia de fechamento {cardDay}</p>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Categoria</Label>
          <Select
            value={value.category_id?.toString() ?? ""}
            onChange={(v) => onChange({ ...value, category_id: v ? Number(v) : null })}
            options={resources.categories.map((c) => ({ value: c.id.toString(), label: c.name }))}
            placeholder="Sem categoria"
          />
        </div>
        <div>
          <Label>Forma de pagamento</Label>
          <Select
            value={value.payment_method_id.toString()}
            onChange={(v) => onChange({ ...value, payment_method_id: Number(v) })}
            options={resources.paymentMethods.map((p) => ({ value: p.id.toString(), label: p.name }))}
          />
        </div>
      </div>
      <div>
        <Label>Mês de início</Label>
        <MonthPicker value={value.start_month} onChange={(m) => onChange({ ...value, start_month: m })} />
      </div>
      {mode === "installments" ? (
        <div>
          <Label>Quantidade de parcelas</Label>
          <Input type="number" min="2" value={value.installments ?? ""}
            onChange={(e) => onChange({ ...value, installments: e.target.value ? Number(e.target.value) : null })} />
        </div>
      ) : (
        <div>
          <Label>Duração</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={!value.end_month} onChange={() => onChange({ ...value, end_month: null })} />
              Indefinida
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={!!value.end_month} onChange={() => onChange({ ...value, end_month: value.start_month })} />
              Até uma data
            </label>
          </div>
          {value.end_month && (
            <div className="mt-2">
              <Label>Mês de fim</Label>
              <MonthPicker value={value.end_month} onChange={(m) => onChange({ ...value, end_month: m })} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
