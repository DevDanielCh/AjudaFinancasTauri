"use client";
import { useCallback, useState } from "react";
import { CrudPage } from "@/components/crud/CrudPage";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { FaturaDetailDialog } from "@/components/transactions/FaturaDetailDialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { useMonth } from "@/lib/month-context";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import { transactionSchema } from "@/lib/schemas";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Sort, TransactionInput } from "@/lib/types";

export default function TransactionsPage() {
  const { month } = useMonth();
  const [faturaId, setFaturaId] = useState<number | null>(null);
  const load = useCallback((sort: Sort | null) => api.listTransactions(month, sort), [month]);
  return (
    <>
      <CrudPage
        config={{
          title: "Transações",
          columns: [
            { header: "Data", sortKey: "date", render: (r) => formatDate(r.date) },
            {
              header: "Tipo",
              sortKey: "type",
              render: (r) => r.is_card_bill ? <Badge>Fatura</Badge>
                : r.type === 1 || r.type === 5 ? <Badge className="bg-positive text-positive-foreground">Receita</Badge>
                : <Badge className="bg-negative text-negative-foreground">Despesa</Badge>,
            },
            { header: "Descrição", sortKey: "description", render: (r) => r.description },
            { header: "Categoria", sortKey: "category", render: (r) => r.category_name ?? "—" },
            { header: "Forma", sortKey: "payment_method", render: (r) => r.payment_method_name ?? "—" },
            {
              header: "Valor",
              sortKey: "amount",
              render: (r) => {
                const positive = r.type === 1 || r.type === 5;
                return (
                  <span className={cn(positive ? "text-positive" : "text-negative", "font-mono")}>
                    {positive ? "+" : "−"} {formatMoney(r.amount)}
                  </span>
                );
              },
            },
          ],
          mobileCorners: {
            topLeft: (r) => r.description,
            bottomLeft: (r) => r.category_name ?? "—",
            topRight: (r) => {
              const positive = r.type === 1 || r.type === 5;
              return (
                <span className={cn(positive ? "text-positive" : "text-negative", "font-mono")}>
                  {positive ? "+" : "−"} {formatMoney(r.amount)}
                </span>
              );
            },
            bottomRight: (r) => formatDate(r.date),
          },
          keepOpen: true,
          load,
          create: api.createTransaction,
          update: (id, d) => api.updateTransaction(id, d),
          remove: api.deleteTransactions,
          empty: (): TransactionInput => ({
            description: "", amount: 0, type: 2, date: new Date().toISOString().slice(0, 10),
            category_id: null, payment_method_id: null, card_mode: 0,
          }),
          toInput: (r): TransactionInput => ({
            description: r.description, amount: r.amount,
            type: r.type === 3 ? 2 : r.type, date: r.date,
            category_id: r.category_id, payment_method_id: r.payment_method_id,
            card_mode: r.card_mode,
          }),
          protected: (r) => r.is_card_bill || r.type === 4 || r.type === 5,
          loadResources: async () => {
            const [categories, paymentMethods] = await Promise.all([
              api.listCategories(), api.listPaymentMethods(),
            ]);
            return { categories, paymentMethods };
          },
          FormFields: TransactionForm,
          queryKey: queryKeys.transactions(month),
          invalidate: [queryKeys.dashboard(month), ["card-bill"]],
          schema: transactionSchema,
          onView: (r) => {
            if (r.is_card_bill) setFaturaId(r.id);
            else toast.add({ title: "Visualizar disponível apenas para faturas", type: "error" });
          },
        }}
      />
      <FaturaDetailDialog id={faturaId} onClose={() => setFaturaId(null)} />
    </>
  );
}
