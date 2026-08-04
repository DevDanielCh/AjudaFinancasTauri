"use client";
import { useCallback } from "react";
import { CrudPage } from "@/components/crud/CrudPage";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { useMonth } from "@/lib/month-context";
import { api } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { Category, PaymentMethod, TransactionInput, TransactionRow } from "@/lib/types";

export default function TransactionsPage() {
  const { month } = useMonth();
  const load = useCallback(() => api.listTransactions(month), [month]);
  return (
    <CrudPage
      config={{
        title: "Transações",
        columns: [
          { header: "Data", render: (r) => formatDate(r.date) },
          { header: "Descrição", render: (r) => r.description },
          { header: "Categoria", render: (r) => r.category_name ?? "—" },
          { header: "Forma", render: (r) => r.payment_method_name ?? "—" },
          {
            header: "Valor",
            render: (r) => (
              <span className={r.type === 1 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                {r.type === 1 ? "+" : "−"} {formatMoney(r.amount)}
              </span>
            ),
          },
        ],
        keepOpen: true,
        load,
        create: api.createTransaction,
        update: (id, d) => api.updateTransaction(id, d),
        remove: api.deleteTransactions,
        empty: (): TransactionInput => ({
          description: "", amount: 0, type: 2, date: new Date().toISOString().slice(0, 10),
          category_id: null, payment_method_id: null,
        }),
        toInput: (r): TransactionInput => ({
          description: r.description, amount: r.amount, type: r.type, date: r.date,
          category_id: r.category_id, payment_method_id: r.payment_method_id,
        }),
        loadResources: async () => {
          const [categories, paymentMethods] = await Promise.all([
            api.listCategories(), api.listPaymentMethods(),
          ]);
          return { categories, paymentMethods };
        },
        FormFields: TransactionForm,
        reloadKey: month,
      }}
    />
  );
}
