"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CategoryInput } from "@/lib/types";

export function CategoryForm({
  value, onChange, error,
}: {
  value: CategoryInput;
  onChange: (v: CategoryInput) => void;
  resources: Record<string, never>;
  error: string | null;
}) {
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
            <input type="radio" checked={value.type === 1} onChange={() => onChange({ ...value, type: 1 })} />
            Receita
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={value.type === 2} onChange={() => onChange({ ...value, type: 2 })} />
            Despesa
          </label>
        </div>
      </div>
      <div>
        <Label>Cor</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} className="h-10 w-14 rounded border border-input bg-background" />
          <Input value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Ícone</Label>
        <Input value={value.icon ?? ""} placeholder="ex.: lucide shopping-cart"
          onChange={(e) => onChange({ ...value, icon: e.target.value || null })} />
      </div>
    </div>
  );
}
