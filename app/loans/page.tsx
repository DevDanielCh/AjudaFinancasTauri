"use client";
import { useState } from "react";
import { HandCoins, Landmark } from "lucide-react";
import { LoansScreen } from "@/components/screens/loans";
import { Badge } from "@/components/ui/badge";
import { FinanciamentoAddForm } from "@/src/OrganizacaoFinanceira/Views/Financiamento/FinanciamentoAddForm";
import { loanApi } from "@/src/OrganizacaoFinanceira/Repositories/loan";
import { paymentMethodApi } from "@/src/OrganizacaoFinanceira/Repositories/payment-method";
import { loanKeys } from "@/src/OrganizacaoFinanceira/Services/loan";
import { loanSchema } from "@/lib/schemas";
import { currentMonthISO, formatMonth, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Loan, LoanInput } from "@/src/OrganizacaoFinanceira/Models/loan";

export default function LoansPage() {
  const [detailId, setDetailId] = useState<number | null>(null);
  return (
    <>
      <LoansScreen
        config={{
          title: "Financiamentos/Empréstimos",
          newTitle: "Novo Financiamento/Empréstimo",
          editTitle: "Editar Financiamento/Empréstimo",
          columns: [
            {
              label: "Descrição",
              name: "description",
              render: (r) => (
                <span className="flex min-w-0 items-center gap-1.5">
                  {r.type === 1 ? (
                    <HandCoins className="size-4 shrink-0 text-sticker-teal" />
                  ) : (
                    <Landmark className="size-4 shrink-0 text-sticker-purple-deep" />
                  )}
                  <span className="truncate">{r.description}</span>
                </span>
              ),
            },
            {
              label: "Tipo",
              name: "type",
              filterId: "type",
              align: "center",
              render: (r) =>
                r.type === 1 ? (
                  <Badge variant="info">Empréstimo</Badge>
                ) : (
                  <Badge variant="purple">Financiamento</Badge>
                ),
            },
            { label: "Valor", name: "principal", align: "right", mono: true, render: (r) => <span className="tabular-nums">{formatMoney(r.principal)}</span> },
            { label: "Parcela", name: "installment", align: "right", mono: true, render: (r) => <span className="tabular-nums">{formatMoney(r.installment)}</span> },
            {
              label: "Parcelas",
              name: "installments",
              align: "center",
              render: (r) => (
                <span className={cn("tabular-nums", r.paid_count >= r.total_installments && "text-positive")}>
                  {r.paid_count}/{r.total_installments}
                </span>
              ),
            },
            { label: "Início", name: "start", align: "center", render: (r) => formatMonth(r.start_month) },
            { label: "Fim", align: "center", render: (r) => formatMonth(r.end_month) },
          ],
          mobileCorners: {
            topLeft: (r) => (
              <span className="flex min-w-0 items-center gap-1.5">
                {r.type === 1 ? (
                  <HandCoins className="size-4 shrink-0 text-sticker-teal" />
                ) : (
                  <Landmark className="size-4 shrink-0 text-sticker-purple-deep" />
                )}
                <span className="truncate">{r.description}</span>
              </span>
            ),
            bottomLeft: (r) => `${r.type === 1 ? "Empréstimo" : "Financiamento"} · ${r.paid_count}/${r.total_installments}`,
            topRight: (r) => (
              <span className="tabular-nums">{formatMoney(r.installment)}</span>
            ),
            bottomRight: (r) => `${formatMonth(r.start_month)} → ${formatMonth(r.end_month)}`,
          },
          load: loanApi.list,
          create: loanApi.create,
          update: (id, d) => loanApi.update(id, d),
          remove: loanApi.remove,
          empty: (): LoanInput => ({
            type: 1, description: "", principal: 0, installment: 0,
            total_installments: 0, day: 1,
            start_month: currentMonthISO(),
            payment_method_id: 0, monthly_rate: 0,
          }),
          toInput: (r: Loan): LoanInput => ({
            type: r.type, description: r.description, principal: r.principal,
            installment: r.installment, total_installments: r.total_installments,
            day: r.day, start_month: r.start_month, payment_method_id: r.payment_method_id,
            monthly_rate: r.monthly_rate,
          }),
          loadResources: async () => ({ paymentMethods: await paymentMethodApi.list() }),
          FormFields: FinanciamentoAddForm,
          onRowDoubleClick: (r) => setDetailId(r.id),
          onView: (r) => setDetailId(r.id),
          queryKey: loanKeys,
          invalidate: [["transactions"], ["dashboard"]],
          schema: loanSchema,
          filters: [
            {
              id: "type", label: "Tipo", field: "select",
              options: [
                { label: "Empréstimo", value: 1 },
                { label: "Financiamento", value: 2 },
              ],
              accessor: (r) => r.type,
            },
            { id: "payment_method", label: "Forma Pgto", field: "select", accessor: (r) => r.payment_method_name },
          ],
          emptyTitle: "Nenhum financiamento",
          emptyDescription: "Acompanhe empréstimos e financiamentos",
        }}
        detailId={detailId}
        onDetailClose={() => setDetailId(null)}
      />
    </>
  );
}
