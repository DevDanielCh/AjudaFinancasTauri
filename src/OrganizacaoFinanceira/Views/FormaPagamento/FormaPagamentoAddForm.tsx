"use client";
import { CreditCard, FileText, Wallet } from "lucide-react";
import { Field, FieldError, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { TypeSelector } from "@/components/forms/TypeSelector";
import { Input } from "@/components/ui/input";
import { StepperInput } from "@/components/forms/StepperInput";
import { FieldErrors } from "@/components/forms/FieldErrors";
import { FormSection } from "@/components/forms/FormSection";
import { useStore } from "@/lib/forms";
import type { PaymentMethodInput } from "../../Models/payment-method";
import type { CrudFormApi } from "@/lib/forms";

export function FormaPagamentoAddForm({
  form,
  serverError,
}: {
  form: CrudFormApi<PaymentMethodInput>;
  serverError: string | null;
}) {
  const values = useStore(form.store, (s) => s.values);
  const isCard = values.type === 2;
  const cardInfo =
    isCard && values.close_day && values.validity_day
      ? `Cartão fecha todo dia ${values.close_day} e vence no dia ${values.validity_day}.`
      : null;

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
                placeholder="ex.: Nubank, Dinheiro, Pix…"
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
                  { value: "1", label: "Padrão", icon: Wallet },
                  { value: "2", label: "Cartão", icon: CreditCard },
                ]}
                value={String(field.state.value)}
                onChange={(v) => {
                  const t = v === "2" ? 2 : 1;
                  field.handleChange(t as PaymentMethodInput["type"]);
                  if (t === 1) {
                    form.setFieldValue("close_day", null);
                    form.setFieldValue("validity_day", null);
                  }
                }}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      </FormSection>
      {isCard && (
        <FormSection title="Cartão" icon={CreditCard}>
          <div className="grid *:min-w-0 grid-cols-2 items-start gap-4">
            <form.Field name="close_day">
              {(field) => (
                <Field>
                  <FieldLabel required>Dia de fechamento</FieldLabel>
                  <StepperInput
                    value={field.state.value ?? 0}
                    min={1}
                    max={31}
                    onChange={(v) => field.handleChange(v || null)}
                  />
                  <FieldErrors errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="validity_day">
              {(field) => (
                <Field>
                  <FieldLabel required>Dia de vencimento</FieldLabel>
                  <StepperInput
                    value={field.state.value ?? 0}
                    min={1}
                    max={31}
                    onChange={(v) => field.handleChange(v || null)}
                  />
                  <FieldErrors errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </div>
          {cardInfo && <FieldDescription>{cardInfo}</FieldDescription>}
        </FormSection>
      )}
    </FieldGroup>
  );
}