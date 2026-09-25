"use client";
import { InstallmentsScreen } from "@/components/screens/installments";
import { CategoryChip } from "@/components/crud/CategoryChip";
import { Badge } from "@/components/ui/badge";
import { ContaFixaAddForm } from "@/src/OrganizacaoFinanceira/Views/ContaFixa/ContaFixaAddForm";
import { fixedBillApi } from "@/src/OrganizacaoFinanceira/Repositories/fixed-bill";
import { categoryApi } from "@/src/OrganizacaoFinanceira/Repositories/category";
import { paymentMethodApi } from "@/src/OrganizacaoFinanceira/Repositories/payment-method";
import { fixedBillKeys } from "@/src/OrganizacaoFinanceira/Services/fixed-bill";
import { fixedBillSchema } from "@/lib/schemas";
import { currentMonthISO, formatMonth, formatMoney } from "@/lib/format";
import type { FixedBillInput } from "@/src/OrganizacaoFinanceira/Models/fixed-bill";
import type { Sort } from "@/src/shared/models";

export default function InstallmentsPage() {
  return (
    <InstallmentsScreen
      config={{
        title: "Parcelamentos",
        columns: [
          {
            label: "Descrição",
            name: "description",
            render: (r) => (
              <span className="flex min-w-0 items-center gap-1.5">
                {r.category_id && <CategoryChip color={r.category_color} icon={r.category_icon} size="sm" />}
                <span className="truncate">{r.description}</span>
              </span>
            ),
          },
          { label: "Valor", name: "amount", align: "right", mono: true, render: (r) => <span className="tabular-nums">{formatMoney(r.amount)}</span> },
          { label: "Dia", name: "day", filterId: "day", align: "center", render: (r) => r.day },
          { label: "Início", name: "start", align: "center", render: (r) => formatMonth(r.start_month) },
          { label: "Fim", name: "end", align: "center", render: (r) => (r.end_month ? formatMonth(r.end_month) : "—") },
          { label: "Parcelas", name: "installments", align: "center", render: (r) => r.installments ?? "—" },
          {
            label: "Status",
            align: "center",
            render: (r) =>
              r.finished ? (
                <Badge variant="default">Finalizado</Badge>
              ) : (
                <Badge variant="positive">Ativo</Badge>
              ),
          },
        ],
        mobileCorners: {
          topLeft: (r) => (
            <span className="flex min-w-0 items-center gap-1.5">
              {r.category_id && <CategoryChip color={r.category_color} icon={r.category_icon} size="sm" />}
              <span className="truncate">{r.description}</span>
            </span>
          ),
          bottomLeft: (r) => r.category_name ? `${r.category_name} · dia ${r.day}` : `dia ${r.day}`,
          topRight: (r) => (
            <span className="tabular-nums">{formatMoney(r.amount)}</span>
          ),
          bottomRight: (r) => `${formatMonth(r.start_month)} → ${r.end_month ? formatMonth(r.end_month) : "—"}`,
        },
        load: (sort: Sort | null) => fixedBillApi.list(true, sort),
        create: fixedBillApi.create,
        update: (id, d) => fixedBillApi.update(id, d),
        remove: fixedBillApi.remove,
        rowClass: (r) => (r.finished ? "opacity-30" : ""),
        empty: (): FixedBillInput => ({
          description: "", amount: 0, day: 1, category_id: null,
          payment_method_id: 0, start_month: currentMonthISO(),
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
        FormFields: (props) => <ContaFixaAddForm {...props} mode="installments" />,
        queryKey: fixedBillKeys(true),
        invalidate: [["transactions"], ["dashboard"]],
        schema: fixedBillSchema,
        emptyTitle: "Nenhum parcelamento",
        emptyDescription: "Registre compras parceladas",
        filters: [
          { id: "category", label: "Categoria", field: "select", accessor: (r) => r.category_name },
          { id: "day", label: "Dia", field: "number", accessor: (r) => r.day },
          {
            id: "status", label: "Status", field: "select",
            options: [
              { label: "Ativo", value: "false" },
              { label: "Finalizado", value: "true" },
            ],
            accessor: (r) => (r.finished ? "true" : "false"),
          },
        ],
      }}
    />
  );
}
