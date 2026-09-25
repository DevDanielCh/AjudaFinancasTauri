"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, Banknote, FileText, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { QuickCreateSelect } from "@/components/forms/QuickCreateSelect";
import { TypeSelector } from "@/components/forms/TypeSelector";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { DatePicker } from "@/components/DatePicker";
import { FieldErrors } from "@/components/forms/FieldErrors";
import { FormSection } from "@/components/forms/FormSection";
import { Spinner } from "@/components/ui/spinner";
import { useStore } from "@/lib/forms";
import { categoryApi } from "../../Repositories/category";
import { paymentMethodApi } from "../../Repositories/payment-method";
import type { Category } from "../../Models/category";
import type { PaymentMethod } from "../../Models/payment-method";
import type { TransactionInput } from "../../Models/transaction";
import type { CrudFormApi } from "@/lib/forms";

const DEFAULT_COLOR = "#62aef0";

export function TransacaoAddForm({
  form,
  resources,
  serverError,
}: {
  form: CrudFormApi<TransactionInput>;
  resources: { categories: Category[]; paymentMethods: PaymentMethod[] } | undefined;
  serverError: string | null;
}) {
  const values = useStore(form.store, (s) => s.values);
  const selectedPm = resources?.paymentMethods.find((p) => p.id === values.payment_method_id);
  const isCard = values.type === 2 && selectedPm?.type === 2;

  const qc = useQueryClient();
  const createCategory = useMutation({ mutationFn: categoryApi.create });
  const createPm = useMutation({ mutationFn: paymentMethodApi.create });

  const refreshResources = async () => {
    await qc.invalidateQueries({
      predicate: (q) => q.queryKey.at(-1) === "resources",
    });
    await qc.invalidateQueries({ queryKey: ["categories"] });
    await qc.invalidateQueries({ queryKey: ["payment-methods"] });
  };

  if (!resources) {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }

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
                  { value: "1", label: "Receita", icon: ArrowUpCircle, tone: "positive" },
                  { value: "2", label: "Despesa", icon: ArrowDownCircle, tone: "negative" },
                ]}
                value={String(field.state.value)}
                onChange={(v) => {
                  field.handleChange(Number(v) as TransactionInput["type"]);
                  form.setFieldValue("card_mode", 0);
                }}
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
                placeholder="ex.: Salário, Mercado, Uber…"
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
                  placeholder="Data"
                  onChange={(d) => { if (d) field.handleChange(d); }}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </div>
      </FormSection>

      <FormSection title="Pagamento" icon={Wallet}>
        <div className="grid *:min-w-0 grid-cols-2 items-start gap-4">
        <form.Field name="category_id">
          {(field) => (
            <Field className={values.type === 2 ? undefined : "col-span-2"}>
              <FieldLabel>Categoria</FieldLabel>
              <QuickCreateSelect
                value={field.state.value?.toString() ?? ""}
                onChange={(v) => {
                  const catId = v ? Number(v) : null;
                  field.handleChange(catId);
                  const cat = resources.categories.find((c) => c.id === catId);
                  if (cat && !values.description.trim()) {
                    form.setFieldValue("description", cat.name);
                  }
                }}
                options={[
                  { value: "", label: "Sem categoria" },
                  ...resources.categories.map((c) => ({ value: c.id.toString(), label: c.name })),
                ]}
                createLabel="Nova categoria"
                createPrompt="Nome da categoria"
                loading={createCategory.isPending}
                onCreate={async (name) => {
                  await createCategory.mutateAsync({
                    name,
                    type: values.type === 1 ? 1 : 2,
                    color: DEFAULT_COLOR,
                    icon: null,
                  });
                  await refreshResources();
                }}
              />
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
        {values.type === 2 && (
          <form.Field name="payment_method_id">
            {(field) => (
              <Field>
                <FieldLabel required>Forma de pagamento</FieldLabel>
                <QuickCreateSelect
                  value={field.state.value?.toString() ?? ""}
                  onChange={(v) => {
                    const pmId = v ? Number(v) : null;
                    const pm = resources.paymentMethods.find((p) => p.id === pmId);
                    field.handleChange(pmId);
                    if (pm?.type !== 2) form.setFieldValue("card_mode", 0);
                  }}
                  options={resources.paymentMethods.map((p) => ({ value: p.id.toString(), label: p.name }))}
                  createLabel="Nova forma de pagamento"
                  createPrompt="Nome da forma de pagamento"
                  loading={createPm.isPending}
                  onCreate={async (name) => {
                    await createPm.mutateAsync({ name, type: 1, close_day: null, validity_day: null });
                    await refreshResources();
                  }}
                />
                <FieldDescription className="text-xs">
                  Obrigatória para despesa
                </FieldDescription>
                <FieldErrors errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        )}
      </div>
      {isCard && (
        <form.Field name="card_mode">
          {(field) => (
            <Field>
              <FieldLabel>Modo</FieldLabel>
              <ToggleGroup
                className="h-10"
                value={[String(field.state.value)]}
                onValueChange={(v) => field.handleChange(v[0] === "1" ? 1 : 0)}
              >
                <ToggleGroupItem value="0">Crédito</ToggleGroupItem>
                <ToggleGroupItem value="1">Débito</ToggleGroupItem>
              </ToggleGroup>
              <FieldErrors errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      )}
      </FormSection>
    </FieldGroup>
  );
}