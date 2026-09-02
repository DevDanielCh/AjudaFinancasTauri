"use client";
import { CrudPage } from "@/components/crud/CrudPage";
import { ContaFixaAddForm } from "@/src/OrganizacaoFinanceira/Views/ContaFixa/ContaFixaAddForm";
import { ContaFixaViewForm } from "@/src/OrganizacaoFinanceira/Views/ContaFixa/ContaFixaViewForm";
import { fixedBillApi } from "@/src/OrganizacaoFinanceira/Repositories/fixed-bill";
import { categoryApi } from "@/src/OrganizacaoFinanceira/Repositories/category";
import { paymentMethodApi } from "@/src/OrganizacaoFinanceira/Repositories/payment-method";
import { fixedBillKeys } from "@/src/OrganizacaoFinanceira/Services/fixed-bill";
import { fixedBillSchema } from "@/lib/schemas";
import { currentMonthISO, formatMonth, formatMoney } from "@/lib/format";
import type { FixedBillInput } from "@/src/OrganizacaoFinanceira/Models/fixed-bill";
import type { Sort } from "@/src/shared/models";

export default function FixedBillsPage() {
  return (
    <CrudPage
      config={{
        title: "Contas Fixas",
        newTitle: "Nova Conta Fixa",
        editTitle: "Editar Conta Fixa",
        columns: [
          { label: "Descrição", name: "description", render: (r) => r.description },
          { label: "Valor", name: "amount", render: (r) => <span className="tabular-nums">{formatMoney(r.amount)}</span> },
          { label: "Dia", name: "day", render: (r) => r.day },
          { label: "Início", name: "start", render: (r) => formatMonth(r.start_month) },
          { label: "Fim", name: "end", render: (r) => (r.end_month ? formatMonth(r.end_month) : "—") },
        ],
        mobileCorners: {
          topLeft: (r) => r.description,
          bottomLeft: (r) => r.category_name ? `${r.category_name} · dia ${r.day}` : `dia ${r.day}`,
          topRight: (r) => (
            <span className="tabular-nums">{formatMoney(r.amount)}</span>
          ),
          bottomRight: (r) => `${formatMonth(r.start_month)} → ${r.end_month ? formatMonth(r.end_month) : "—"}`,
        },
        load: (sort: Sort | null) => fixedBillApi.list(false, sort),
        create: fixedBillApi.create,
        update: (id, d) => fixedBillApi.update(id, d),
        remove: fixedBillApi.remove,
        empty: (): FixedBillInput => ({
          description: "", amount: 0, day: 1, category_id: null,
          payment_method_id: 0, start_month: currentMonthISO(),
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
            categoryApi.list(), paymentMethodApi.list(),
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
        FormFields: (props) => <ContaFixaAddForm {...props} mode="recurring" />,
        ViewFields: ContaFixaViewForm,
        queryKey: fixedBillKeys(false),
        invalidate: [["transactions"], ["dashboard"]],
        schema: fixedBillSchema,
      }}
    />
  );
}
