"use client";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { TypeSelector } from "@/components/forms/TypeSelector";
import { Switch } from "@/components/ui/switch";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { DatePicker } from "@/components/DatePicker";
import { FieldErrors } from "@/components/forms/FieldErrors";
import { FormSection } from "@/components/forms/FormSection";
import { ArrowDownToLine, ArrowUpFromLine, Banknote, FileText, Landmark } from "lucide-react";
import type { ReservaInput } from "../../Models/reserva";
import type { CrudFormApi } from "@/lib/forms";

export function ReservaAddForm({
  form,
  serverError,
}: {
  form: CrudFormApi<ReservaInput>;
  resources: undefined;
  serverError: string | null;
}) {
  return (
    <FieldGroup>
      {serverError && <FieldError>{serverError}</FieldError>}
      <FormSection title="Identificação" icon={FileText}>
        <form.Field name="type">
          {(field) => (
            <Field>
              <FieldLabel required>Tipo</FieldLabel>
              <TypeSelector
                options={[
                  { value: "4", label: "Adicionar", icon: ArrowDownToLine, tone: "positive" },
                  { value: "5", label: "Remover", icon: ArrowUpFromLine, tone: "negative" },
                ]}
                value={String(field.state.value)}
                onChange={(v) => field.handleChange(v === "5" ? 5 : 4)}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
        <form.Field name="description">
          {(field) => (
            <Field>
              <FieldLabel required>Descrição</FieldLabel>
              <Input
                size="lg"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="ex.: Rendimento mensal, Pix para a reserva…"
              />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      </FormSection>

      <FormSection title="Valores" icon={Banknote}>
        <div className="grid *:min-w-0 grid-cols-2 items-start gap-4">
          <form.Field name="amount">
            {(field) => (
              <Field>
                <FieldLabel required>Valor (R$)</FieldLabel>
                <MoneyInput
                  size="lg"
                  className="h-12 rounded-md text-2xl font-bold tabular-nums"
                  value={field.state.value}
                  onChange={(c) => field.handleChange(c)}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <form.Field name="date">
            {(field) => (
              <Field>
                <FieldLabel required>Data</FieldLabel>
                <DatePicker
                  size="lg"
                  value={field.state.value}
                  placeholder="Data da movimentação"
                  onChange={(d) => { if (d) field.handleChange(d); }}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </div>
      </FormSection>

      <FormSection title="Destino" icon={Landmark}>
        <form.Field name="in_principal">
        {(field) => {
          const checked = field.state.value;
          return (
            <Field>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="flex flex-col gap-0.5">
                  <FieldLabel>Movimentar conta principal</FieldLabel>
                  <p className="text-xs text-muted-foreground">
                    Desligue para registrar apenas na reserva (ex.: rendimento), sem gerar despesa/receita na conta principal.
                  </p>
                </div>
                <Switch
                  checked={checked}
                  onCheckedChange={(c) => field.handleChange(c)}
                />
              </div>
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          );
        }}
      </form.Field>
      </FormSection>
    </FieldGroup>
  );
}