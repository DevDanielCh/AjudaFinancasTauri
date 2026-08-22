"use client";
import { useState } from "react";
import { CrudPage } from "@/components/crud/CrudPage";
import { FinanciamentoAddForm } from "@/src/OrganizacaoFinanceira/Views/Financiamento/FinanciamentoAddForm";
import { FinanciamentoViewForm } from "@/src/OrganizacaoFinanceira/Views/Financiamento/FinanciamentoViewForm";
import { loanApi } from "@/src/OrganizacaoFinanceira/Repositories/loan";
import { paymentMethodApi } from "@/src/OrganizacaoFinanceira/Repositories/payment-method";
import { loanKeys } from "@/src/OrganizacaoFinanceira/Services/loan";
import { loanSchema } from "@/lib/schemas";
import { formatMonth, formatMoney } from "@/lib/format";
import type { Loan, LoanInput } from "@/src/OrganizacaoFinanceira/Models/loan";

export default function LoansPage() {
  const [detailId, setDetailId] = useState<number | null>(null);
  return (
    <>
      <CrudPage
        config={{
          title: "Financiamentos/Empréstimos",
          columns: [
            { label: "Descrição", name: "description", render: (r) => r.description },
            { label: "Tipo", name: "type", render: (r) => (r.type === 1 ? "Empréstimo" : "Financiamento") },
            { label: "Valor", name: "principal", render: (r) => <span className="tabular-nums">{formatMoney(r.principal)}</span> },
            { label: "Parcela", name: "installment", render: (r) => <span className="tabular-nums">{formatMoney(r.installment)}</span> },
            { label: "Parcelas", name: "installments", render: (r) => `${r.paid_count}/${r.total_installments}` },
            { label: "Início", name: "start", render: (r) => formatMonth(r.start_month) },
            { label: "Fim", render: (r) => formatMonth(r.end_month) },
          ],
          mobileCorners: {
            topLeft: (r) => r.description,
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
            start_month: new Date().toISOString().slice(0, 7),
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
        }}
      />
      <FinanciamentoViewForm id={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}
