"use client";
import { useCallback, useState } from "react";
import { CrudPage } from "@/components/crud/CrudPage";
import { TransacaoAddForm } from "@/src/OrganizacaoFinanceira/Views/Transacao/TransacaoAddForm";
import { TransacaoViewForm } from "@/src/OrganizacaoFinanceira/Views/Transacao/TransacaoViewForm";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { useMonth } from "@/lib/month-context";
import { transactionApi } from "@/src/OrganizacaoFinanceira/Repositories/transaction";
import { categoryApi } from "@/src/OrganizacaoFinanceira/Repositories/category";
import { paymentMethodApi } from "@/src/OrganizacaoFinanceira/Repositories/payment-method";
import { transactionKeys } from "@/src/OrganizacaoFinanceira/Services/transaction";
import { dashboardKeys } from "@/src/shared/services";
import { transactionSchema } from "@/lib/schemas";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Sort } from "@/src/shared/models";
import type { TransactionInput } from "@/src/OrganizacaoFinanceira/Models/transaction";

export default function TransactionsPage() {
  const { month } = useMonth();
  const [faturaId, setFaturaId] = useState<number | null>(null);
  const load = useCallback((sort: Sort | null) => transactionApi.list(month, sort), [month]);
  return (
    <>
      <CrudPage
        config={{
          title: "Transações",
          columns: [
            { label: "Data", name: "date", render: (r) => formatDate(r.date) },
            {
              label: "Tipo",
              name: "type",
              render: (r) => {
                const isReserva = r.type === 4 || r.type === 5;
                if (r.is_card_bill) return <Badge>Fatura</Badge>;
                if (isReserva) return <Badge className="bg-sticker-teal text-white">Reserva</Badge>;
                return r.type === 1
                  ? <Badge className="bg-positive text-positive-foreground">Receita</Badge>
                  : <Badge className="bg-negative text-negative-foreground">Despesa</Badge>;
              },
            },
            { label: "Descrição", name: "description", render: (r) => r.description },
            { label: "Categoria", name: "category", render: (r) => r.category_name ?? "—" },
            { label: "Forma", name: "payment_method", render: (r) => r.payment_method_name ?? "—" },
            {
              label: "Valor",
              name: "amount",
              render: (r) => {
                const positive = r.type === 1 || r.type === 5;
                return (
                  <span className={cn(positive ? "text-positive" : "text-negative", "tabular-nums")}>
                    {positive ? "+" : "−"} {formatMoney(r.amount)}
                  </span>
                );
              },
            },
          ],
          mobileCorners: {
            topLeft: (r) => r.description,
            bottomLeft: (r) =>
              r.type === 4 || r.type === 5 ? "Reserva" : r.category_name ?? "—",
            topRight: (r) => {
              const positive = r.type === 1 || r.type === 5;
              return (
                <span className={cn(positive ? "text-positive" : "text-negative", "tabular-nums")}>
                  {positive ? "+" : "−"} {formatMoney(r.amount)}
                </span>
              );
            },
            bottomRight: (r) => formatDate(r.date),
          },
          keepOpen: true,
          load,
          create: transactionApi.create,
          update: (id, d) => transactionApi.update(id, d),
          remove: transactionApi.remove,
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
              categoryApi.list(), paymentMethodApi.list(),
            ]);
            return { categories, paymentMethods };
          },
          FormFields: TransacaoAddForm,
          queryKey: transactionKeys(month),
          invalidate: [dashboardKeys(month), ["card-bill"]],
          schema: transactionSchema,
          onView: (r) => {
            if (r.is_card_bill) setFaturaId(r.id);
            else toast.add({ title: "Visualizar disponível apenas para faturas", type: "error" });
          },
        }}
      />
      <TransacaoViewForm id={faturaId} onClose={() => setFaturaId(null)} />
    </>
  );
}
