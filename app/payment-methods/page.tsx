"use client";
import { CrudPage } from "@/components/crud/CrudPage";
import { PaymentMethodForm } from "@/components/forms/PaymentMethodForm";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import { paymentMethodSchema } from "@/lib/schemas";
import type { PaymentMethodInput } from "@/lib/types";

export default function PaymentMethodsPage() {
  return (
    <CrudPage
      config={{
        title: "Formas de Pagamento",
        columns: [
          { label: "Nome", name: "name", render: (r) => r.name },
          { label: "Tipo", name: "type", render: (r) => (r.type === 2 ? "Cartão" : "Padrão") },
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
        load: api.listPaymentMethods,
        create: api.createPaymentMethod,
        update: (id, d) => api.updatePaymentMethod(id, d),
        remove: api.deletePaymentMethods,
        empty: (): PaymentMethodInput => ({ name: "", type: 1, close_day: null, validity_day: null }),
        toInput: (r): PaymentMethodInput => {
          const m = r.metadata ? JSON.parse(r.metadata) : null;
          return {
            name: r.name, type: r.type,
            close_day: r.type === 2 ? (m?.close_day ?? null) : null,
            validity_day: r.type === 2 ? (m?.validity_day ?? null) : null,
          };
        },
        FormFields: PaymentMethodForm,
        queryKey: queryKeys.paymentMethods,
        invalidate: [["transactions"], ["fixed-bills"], ["dashboard"]],
        schema: paymentMethodSchema,
      }}
    />
  );
}
