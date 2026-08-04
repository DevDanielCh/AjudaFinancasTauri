"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/forms/Select";
import { MonthPicker } from "@/components/MonthPicker";
import type { LoanInput, PaymentMethod } from "@/lib/types";

export function LoanForm({
  value, onChange, resources, error,
}: {
  value: LoanInput;
  onChange: (v: LoanInput) => void;
  resources: { paymentMethods: PaymentMethod[] };
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Label>Tipo</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={value.type === 1} onChange={() => onChange({ ...value, type: 1 })} />
            Empréstimo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={value.type === 2} onChange={() => onChange({ ...value, type: 2 })} />
            Financiamento
          </label>
        </div>
      </div>
      <div>
        <Label>Descrição</Label>
        <Input value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" min="0"
            value={value.principal === 0 ? "" : (value.principal / 100).toFixed(2)}
            onChange={(e) => onChange({ ...value, principal: Math.round(Number(e.target.value) * 100) })} />
        </div>
        <div>
          <Label>Valor da parcela (R$)</Label>
          <Input type="number" step="0.01" min="0"
            value={value.installment === 0 ? "" : (value.installment / 100).toFixed(2)}
            onChange={(e) => onChange({ ...value, installment: Math.round(Number(e.target.value) * 100) })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Número de parcelas</Label>
          <Input type="number" min="2" value={value.total_installments || ""}
            onChange={(e) => onChange({ ...value, total_installments: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Dia</Label>
          <Input type="number" min="1" max="31" value={value.day || ""}
            onChange={(e) => onChange({ ...value, day: Number(e.target.value) })} />
        </div>
      </div>
      <div>
        <Label>Mês de início</Label>
        <MonthPicker value={value.start_month} onChange={(m) => onChange({ ...value, start_month: m })} />
      </div>
      <div>
        <Label>Forma de pagamento</Label>
        <Select
          value={value.payment_method_id.toString()}
          onChange={(v) => onChange({ ...value, payment_method_id: Number(v) })}
          options={resources.paymentMethods.map((p) => ({ value: p.id.toString(), label: p.name }))}
        />
      </div>
      {value.total_installments >= 2 && value.installment * value.total_installments < value.principal && (
        <p className="text-sm text-destructive">Total das parcelas menor que o valor</p>
      )}
    </div>
  );
}
