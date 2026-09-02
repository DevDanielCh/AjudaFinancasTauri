"use client";
import { Pipette } from "lucide-react";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { CategoryIconPicker } from "./CategoryIconPicker";
import { FieldErrors } from "@/components/forms/FieldErrors";
import { cn } from "@/lib/utils";
import type { CategoryInput } from "../../Models/category";
import type { CrudFormApi } from "@/lib/forms";

const PALETTE = [
  "#62aef0", "#2a9d99", "#1aae39",
  "#dd5b00", "#a855f7", "#ec4899",
  "#0ea5e9", "#6366f1", "#f43f5e",
  "#523410", "#111827", "#6b7280",
];

export function CategoriaAddForm({
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
            <FieldLabel required>Nome</FieldLabel>
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
            <FieldLabel required>Tipo</FieldLabel>
            <ToggleGroup
              className="w-full"
              orientation="vertical"
              value={[String(field.state.value)]}
              onValueChange={(v) => field.handleChange(v[0] === "2" ? 2 : 1)}
            >
              <ToggleGroupItem className="w-full" value="1">Receita</ToggleGroupItem>
              <ToggleGroupItem className="w-full" value="2">Despesa</ToggleGroupItem>
            </ToggleGroup>
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field name="color">
        {(field) => (
          <Field>
            <FieldLabel required>Cor</FieldLabel>
            <div className="flex flex-wrap items-center gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => field.handleChange(c)}
                  style={{ backgroundColor: c }}
                  className={cn(
                    "size-7 cursor-pointer rounded-full border border-black/10 transition-transform hover:scale-110",
                    field.state.value.toLowerCase() === c &&
                      "ring-2 ring-ring ring-offset-2 ring-offset-popover dark:ring-offset-popover"
                  )}
                />
              ))}
              <label
                className={cn(
                  "relative flex size-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground transition-transform hover:scale-110",
                  !PALETTE.includes(field.state.value.toLowerCase()) &&
                    "ring-2 ring-ring ring-offset-2 ring-offset-popover dark:ring-offset-popover"
                )}
                title="Cor personalizada"
              >
                {!PALETTE.includes(field.state.value.toLowerCase()) && (
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: field.state.value }}
                  />
                )}
                <Pipette className="relative size-3.5 drop-shadow" />
                <input
                  type="color"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
              </label>
            </div>
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <form.Field name="icon">
        {(field) => (
          <Field>
            <FieldLabel>Ícone</FieldLabel>
            <CategoryIconPicker
              value={field.state.value}
              onChange={(v) => field.handleChange(v)}
            />
            <FieldErrors errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
    </FieldGroup>
  );
}
