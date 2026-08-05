"use client";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
    <FieldGroup>
      <FieldError>{error}</FieldError>
      <Field>
        <FieldLabel>Nome</FieldLabel>
        <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel>Tipo</FieldLabel>
        <ToggleGroup
          value={[String(value.type)]}
          onValueChange={(v) => onChange({ ...value, type: v[0] === "2" ? 2 : 1 })}
        >
          <ToggleGroupItem value="1">Receita</ToggleGroupItem>
          <ToggleGroupItem value="2">Despesa</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <Field>
        <FieldLabel>Cor</FieldLabel>
        <div className="flex items-center gap-2">
          <input type="color" value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} className="h-10 w-14 rounded border border-input bg-background" />
          <Input value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} />
        </div>
      </Field>
      <Field>
        <FieldLabel>Ícone</FieldLabel>
        <Input value={value.icon ?? ""} placeholder="ex.: lucide shopping-cart"
          onChange={(e) => onChange({ ...value, icon: e.target.value || null })} />
      </Field>
    </FieldGroup>
  );
}
