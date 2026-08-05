"use client";
import { CrudPage } from "@/components/crud/CrudPage";
import { FixedBillForm } from "@/components/forms/FixedBillForm";
import { api } from "@/lib/api";
import { formatMonth, formatMoney } from "@/lib/format";
import type { FixedBillInput } from "@/lib/types";

export default function InstallmentsPage() {
  return (
    <CrudPage
      config={{
        title: "Parcelamentos",
        columns: [
          { header: "Descrição", render: (r) => r.description },
          { header: "Valor", render: (r) => <span className="font-mono">{formatMoney(r.amount)}</span> },
          { header: "Dia", render: (r) => r.day },
          { header: "Início", render: (r) => formatMonth(r.start_month) },
          { header: "Fim", render: (r) => (r.end_month ? formatMonth(r.end_month) : "—") },
          { header: "Parcelas", render: (r) => r.installments ?? "—" },
        ],
        load: () => api.listFixedBills(true),
        create: api.createFixedBill,
        update: (id, d) => api.updateFixedBill(id, d),
        remove: api.deleteFixedBills,
        empty: (): FixedBillInput => ({
          description: "", amount: 0, day: 1, category_id: null,
          payment_method_id: 0, start_month: new Date().toISOString().slice(0, 7),
          end_month: null, installments: 2, purchase_date: null,
        }),
        toInput: (r): FixedBillInput => ({
          description: r.description, amount: r.amount, day: r.day,
          category_id: r.category_id, payment_method_id: r.payment_method_id,
          start_month: r.start_month, end_month: r.end_month,
          installments: r.installments, purchase_date: r.purchase_date,
        }),
        loadResources: async () => {
          const [categories, paymentMethods] = await Promise.all([
            api.listCategories(), api.listPaymentMethods(),
          ]);
          const cardCloseDays: Record<number, number> = {};
          const cardValidityDays: Record<number, number> = {};
          for (const pm of paymentMethods) {
            if (pm.type === 2 && pm.metadata) {
              try {
                const m = JSON.parse(pm.metadata);
                if (m.close_day) cardCloseDays[pm.id] = m.close_day;
                if (m.validity_day) cardValidityDays[pm.id] = m.validity_day;
              } catch { /* ignore */ }
            }
          }
          return { categories, paymentMethods, cardCloseDays, cardValidityDays };
        },
        FormFields: (props) => <FixedBillForm {...props} mode="installments" />,
      }}
    />
  );
}
