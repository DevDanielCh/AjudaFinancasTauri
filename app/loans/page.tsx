"use client";
import { useState } from "react";
import { CrudPage } from "@/components/crud/CrudPage";
import { LoanForm } from "@/components/forms/LoanForm";
import { DetailDialog } from "@/components/loans/DetailDialog";
import { api } from "@/lib/api";
import { formatMonth, formatMoney } from "@/lib/format";
import type { Loan, LoanInput } from "@/lib/types";

export default function LoansPage() {
  const [detailId, setDetailId] = useState<number | null>(null);
  return (
    <>
      <CrudPage
        config={{
          title: "Financiamentos/Empréstimos",
          columns: [
            { header: "Descrição", render: (r) => r.description },
            { header: "Tipo", render: (r) => (r.type === 1 ? "Empréstimo" : "Financiamento") },
            { header: "Valor", render: (r) => <span className="font-mono">{formatMoney(r.principal)}</span> },
            { header: "Parcela", render: (r) => <span className="font-mono">{formatMoney(r.installment)}</span> },
            { header: "Parcelas", render: (r) => `${r.paid_count}/${r.total_installments}` },
            { header: "Início", render: (r) => formatMonth(r.start_month) },
            { header: "Fim", render: (r) => formatMonth(r.end_month) },
          ],
          load: api.listLoans,
          create: api.createLoan,
          update: (id, d) => api.updateLoan(id, d),
          remove: api.deleteLoans,
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
          loadResources: async () => ({ paymentMethods: await api.listPaymentMethods() }),
          FormFields: LoanForm,
          onRowDoubleClick: (r) => setDetailId(r.id),
          onView: (r) => setDetailId(r.id),
        }}
      />
      <DetailDialog id={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}
