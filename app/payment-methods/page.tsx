"use client";
import { CrudPage } from "@/components/crud/CrudPage";
import { FormaPagamentoAddForm } from "@/src/OrganizacaoFinanceira/Views/FormaPagamento/FormaPagamentoAddForm";
import { FormaPagamentoViewForm } from "@/src/OrganizacaoFinanceira/Views/FormaPagamento/FormaPagamentoViewForm";
import { paymentMethodApi } from "@/src/OrganizacaoFinanceira/Repositories/payment-method";
import { paymentMethodKeys } from "@/src/OrganizacaoFinanceira/Services/payment-method";
import { paymentMethodSchema } from "@/lib/schemas";
import type { PaymentMethodInput } from "@/src/OrganizacaoFinanceira/Models/payment-method";

export default function PaymentMethodsPage() {
  return (
    <CrudPage
      config={{
        title: "Formas de Pagamento",
        newTitle: "Nova Forma de Pagamento",
        editTitle: "Editar Forma de Pagamento",
        columns: [
          { label: "Nome", name: "name", render: (r) => r.name },
          { label: "Tipo", name: "type", filterId: "type", render: (r) => (r.type === 2 ? "Cartão" : "Padrão") },
          {
            label: "Fechamento/Vencimento",
            render: (r) => {
              if (r.type !== 2) return "—";
              try {
                const m = r.metadata ? JSON.parse(r.metadata) : null;
                return m?.close_day ? `${m.close_day}/${m.validity_day ?? "?"}` : "—";
              } catch { return "—"; }
            },
          },
        ],
        mobileCorners: {
          topLeft: (r) => r.name,
          bottomLeft: (r) => (r.type === 2 ? "Cartão" : "Padrão"),
          bottomRight: (r) => {
            if (r.type !== 2) return "—";
            try {
              const m = r.metadata ? JSON.parse(r.metadata) : null;
              return m?.close_day ? `${m.close_day}/${m.validity_day ?? "?"}` : "—";
            } catch { return "—"; }
          },
        },
        load: paymentMethodApi.list,
        create: paymentMethodApi.create,
        update: (id, d) => paymentMethodApi.update(id, d),
        remove: paymentMethodApi.remove,
        empty: (): PaymentMethodInput => ({ name: "", type: 1, close_day: null, validity_day: null }),
        toInput: (r): PaymentMethodInput => {
          const m = r.metadata ? JSON.parse(r.metadata) : null;
          return {
            name: r.name, type: r.type,
            close_day: r.type === 2 ? (m?.close_day ?? null) : null,
            validity_day: r.type === 2 ? (m?.validity_day ?? null) : null,
          };
        },
        FormFields: FormaPagamentoAddForm,
        ViewFields: FormaPagamentoViewForm,
        queryKey: paymentMethodKeys,
        invalidate: [["transactions"], ["fixed-bills"], ["dashboard"]],
        schema: paymentMethodSchema,
        filters: [
          {
            id: "type", label: "Tipo", field: "select",
            options: [
              { label: "Padrão", value: 1 },
              { label: "Cartão", value: 2 },
            ],
            accessor: (r) => r.type,
          },
        ],
      }}
    />
  );
}
