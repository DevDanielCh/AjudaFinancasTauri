"use client";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FieldErrors } from "@/components/forms/FieldErrors";
import type { CategoryInput } from "@/lib/types";
import type { CrudFormApi } from "@/lib/forms";

export function CategoryForm({
  form,
  serverError,
}: {
  form: CrudFormApi<CategoryInput>;
  serverError: string | null;
}) {
  return (
    <FieldGroup>
      {serverError && <FieldError>{serverError}</FieldError>}
      <form.Field name="name">
        {(field) => (
          <Field>
            <FieldLabel>Nome</FieldLabel>
            <Input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field name="type">
        {(field) => (
          <Field>
            <FieldLabel>Tipo</FieldLabel>
            <ToggleGroup
              value={[String(field.state.value)]}
              onValueChange={(v) => field.handleChange(v[0] === "2" ? 2 : 1)}
            >
              <ToggleGroupItem value="1">Receita</ToggleGroupItem>
              <ToggleGroupItem value="2">Despesa</ToggleGroupItem>
            </ToggleGroup>
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field name="color">
        {(field) => (
          <Field>
            <FieldLabel>Cor</FieldLabel>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-10 w-14 rounded border border-input bg-background"
              />
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
            </div>
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field name="icon">
        {(field) => (
          <Field>
            <FieldLabel>Ícone</FieldLabel>
            <Input
              value={field.state.value ?? ""}
              placeholder="ex.: lucide shopping-cart"
              onChange={(e) => field.handleChange(e.target.value || null)}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
    </FieldGroup>
  );
}
