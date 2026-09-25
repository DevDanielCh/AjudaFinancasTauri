"use client";
import { createElement } from "react";
import { FileText, Palette, Pipette } from "lucide-react";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { TypeSelector } from "@/components/forms/TypeSelector";
import { Input } from "@/components/ui/input";
import { CategoryIconPicker } from "./CategoryIconPicker";
import { FieldErrors } from "@/components/forms/FieldErrors";
import { FormSection } from "@/components/forms/FormSection";
import { getCategoryIcon } from "./icons";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/forms";
import type { CategoryInput } from "../../Models/category";
import type { CrudFormApi } from "@/lib/forms";

const PALETTE = [
  "#62aef0", "#2a9d99", "#1aae39",
  "#dd5b00", "#a855f7", "#ec4899",
  "#0ea5e9", "#6366f1", "#f43f5e",
  "#523410", "#111827", "#6b7280",
];

function foregroundOn(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111827" : "#ffffff";
}

export function CategoriaAddForm({
  form,
  serverError,
}: {
  form: CrudFormApi<CategoryInput>;
  serverError: string | null;
}) {
  const { name, color, type, icon } = useStore(form.store, (s) => s.values);

  return (
    <FieldGroup>
      {serverError && <FieldError>{serverError}</FieldError>}
      <FormSection title="Identificação" icon={FileText}>
        <form.Field name="name">
          {(field) => (
            <Field>
              <FieldLabel required>Nome</FieldLabel>
              <Input
                size="lg"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="ex.: Mercado, Transporte…"
              />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
        <form.Field name="type">
          {(field) => (
            <Field>
              <FieldLabel required>Tipo</FieldLabel>
              <TypeSelector
                options={[
                  { value: "1", label: "Receita", tone: "positive" },
                  { value: "2", label: "Despesa", tone: "negative" },
                ]}
                value={String(field.state.value)}
                onChange={(v) => field.handleChange(v === "2" ? 2 : 1)}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      </FormSection>

      <FormSection title="Aparência" icon={Palette}>
        <div
          className="flex items-center gap-3 rounded-xl border p-3"
          aria-hidden
        >
          <span
            className="grid size-11 shrink-0 place-items-center rounded-lg"
            style={{ backgroundColor: color, color: foregroundOn(color) }}
          >
            {createElement(getCategoryIcon(icon) ?? (() => null), { className: "size-5" })}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">
              {name.trim() || "Nome da categoria"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {type === 1 ? "Receita" : "Despesa"}
            </span>
          </span>
        </div>
        <form.Field name="color">
        {(field) => (
          <Field>
            <FieldLabel required>Cor</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={field.state.value.toLowerCase() === c}
                  onClick={() => field.handleChange(c)}
                  style={{ backgroundColor: c }}
                  className={cn(
                    "size-8 cursor-pointer rounded-full border border-black/10 transition-transform hover:scale-110",
                    field.state.value.toLowerCase() === c &&
                      "ring-2 ring-ring ring-offset-2 ring-offset-popover dark:ring-offset-popover"
                  )}
                />
              ))}
              <label
                className={cn(
                  "relative flex size-8 cursor-pointer items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground transition-transform hover:scale-110",
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
      </FormSection>
    </FieldGroup>
  );
}