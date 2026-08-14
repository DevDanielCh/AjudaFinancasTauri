"use client";
import { CrudPage } from "@/components/crud/CrudPage";
import { FixedBillForm } from "@/components/forms/FixedBillForm";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import { fixedBillSchema } from "@/lib/schemas";
import { formatMonth, formatMoney } from "@/lib/format";
import type { FixedBillInput, Sort } from "@/lib/types";

export default function FixedBillsPage() {
  return (
    <CrudPage
      config={{
        title: "Contas Fixas",
        columns: [
          { header: "Descrição", sortKey: "description", render: (r) => r.description },
          { header: "Valor", sortKey: "amount", render: (r) => <span className="font-mono">{formatMoney(r.amount)}</span> },
          { header: "Dia", sortKey: "day", render: (r) => r.day },
          { header: "Início", sortKey: "start", render: (r) => formatMonth(r.start_month) },
          { header: "Fim", sortKey: "end", render: (r) => (r.end_month ? formatMonth(r.end_month) : "—") },
        ],
        mobileCorners: {
          topLeft: (r) => r.description,
          bottomLeft: (r) => r.category_name ? `${r.category_name} · dia ${r.day}` : `dia ${r.day}`,
          topRight: (r) => (
            <span className="font-mono">{formatMoney(r.amount)}</span>
          ),
          bottomRight: (r) => `${formatMonth(r.start_month)} → ${r.end_month ? formatMonth(r.end_month) : "—"}`,
        },
        load: (sort: Sort | null) => api.listFixedBills(false, sort),
        create: api.createFixedBill,
        update: (id, d) => api.updateFixedBill(id, d),
        remove: api.deleteFixedBills,
        empty: (): FixedBillInput => ({
          description: "", amount: 0, day: 1, category_id: null,
          payment_method_id: 0, start_month: new Date().toISOString().slice(0, 7),
          end_month: null, installments: null, purchase_date: null,
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
        FormFields: (props) => <FixedBillForm {...props} mode="recurring" />,
        queryKey: queryKeys.fixedBills(false),
        invalidate: [["transactions"], ["dashboard"]],
        schema: fixedBillSchema,
      }}
    />
  );
}
