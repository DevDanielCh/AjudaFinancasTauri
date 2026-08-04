"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentMethodInput } from "@/lib/types";

export function PaymentMethodForm({
  value, onChange, error,
}: {
  value: PaymentMethodInput;
  onChange: (v: PaymentMethodInput) => void;
  resources: Record<string, never>;
  error: string | null;
}) {
  const isCard = value.type === 2;
  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Label>Nome</Label>
        <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </div>
      <div>
        <Label>Tipo</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={!isCard} onChange={() => onChange({ ...value, type: 1, close_day: null, validity_day: null })} />
            Padrão
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={isCard} onChange={() => onChange({ ...value, type: 2 })} />
            Cartão
          </label>
        </div>
      </div>
      {isCard && (
        <>
          <div>
            <Label>Dia de fechamento</Label>
            <Input type="number" min="1" max="31" value={value.close_day ?? ""}
              onChange={(e) => onChange({ ...value, close_day: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <Label>Dia de vencimento</Label>
            <Input type="number" min="1" max="31" value={value.validity_day ?? ""}
              onChange={(e) => onChange({ ...value, validity_day: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </>
      )}
    </div>
  );
}
