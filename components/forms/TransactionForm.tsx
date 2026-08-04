"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/forms/Select";
import type { Category, PaymentMethod, TransactionInput } from "@/lib/types";

export function TransactionForm({
  value, onChange, resources, error,
}: {
  value: TransactionInput;
  onChange: (v: TransactionInput) => void;
  resources: { categories: Category[]; paymentMethods: PaymentMethod[] };
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Label>Descrição</Label>
        <Input value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </div>
      <div>
        <Label>Valor (R$)</Label>
        <Input
          type="number" step="0.01" min="0"
          value={value.amount === 0 ? "" : (value.amount / 100).toFixed(2)}
          onChange={(e) => onChange({ ...value, amount: Math.round(Number(e.target.value) * 100) })}
        />
      </div>
      <div>
        <Label>Tipo</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio" name="tx-type" checked={value.type === 1}
              onChange={() => onChange({ ...value, type: 1 })}
            />
            Receita
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio" name="tx-type" checked={value.type === 2}
              onChange={() => onChange({ ...value, type: 2 })}
            />
            Despesa
          </label>
        </div>
      </div>
      <div>
        <Label>Data</Label>
        <Input
          type="date"
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
        />
      </div>
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
          value={value.payment_method_id?.toString() ?? ""}
          onChange={(v) => onChange({ ...value, payment_method_id: v ? Number(v) : null })}
          options={resources.paymentMethods.map((p) => ({ value: p.id.toString(), label: p.name }))}
          placeholder={value.type === 2 ? "Obrigatória para despesa" : "Opcional"}
        />
      </div>
    </div>
  );
}
