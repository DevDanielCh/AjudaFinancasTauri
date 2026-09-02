"use client";
import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CrudPage } from "@/components/crud/CrudPage";
import { TransacaoAddForm } from "@/src/OrganizacaoFinanceira/Views/Transacao/TransacaoAddForm";
import { TransacaoViewForm } from "@/src/OrganizacaoFinanceira/Views/Transacao/TransacaoViewForm";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { useMonth } from "@/lib/month-context";
import { transactionApi } from "@/src/OrganizacaoFinanceira/Repositories/transaction";
import { categoryApi } from "@/src/OrganizacaoFinanceira/Repositories/category";
import { paymentMethodApi } from "@/src/OrganizacaoFinanceira/Repositories/payment-method";
import { transactionKeys } from "@/src/OrganizacaoFinanceira/Services/transaction";
import { dashboardKeys } from "@/src/shared/services";
import { transactionSchema } from "@/lib/schemas";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Sort } from "@/src/shared/models";
import type { TransactionInput, TransactionRow } from "@/src/OrganizacaoFinanceira/Models/transaction";

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsContent />
    </Suspense>
  );
}

function TransactionsContent() {
  const searchParams = useSearchParams();
  const autoCreate = searchParams.get("new") === "1";
  const { month } = useMonth();
  const [faturaId, setFaturaId] = useState<number | null>(null);
  const load = useCallback((sort: Sort | null) => transactionApi.list(month, sort), [month]);
  return (
    <>
      <CrudPage
        autoCreate={autoCreate}
        config={{
          title: "Transações",
          addLabel: "Nova Transação",
          newTitle: "Nova Transação",
          editTitle: "Editar Transação",
          columns: [
            { label: "Data", name: "date", filterId: "date", render: (r) => formatDate(r.date) },
            {
              label: "Tipo",
              name: "type",
              filterId: "type",
              render: (r) => {
                const isReserva = r.type === 4 || r.type === 5;
                if (r.is_card_bill) return <Badge>Fatura</Badge>;
                if (isReserva) return <Badge variant="outline">Reserva</Badge>;
                return r.type === 1
                  ? <Badge variant="positive">Receita</Badge>
                  : <Badge variant="negative">Despesa</Badge>;
              },
            },
            { label: "Descrição", name: "description", render: (r) => r.description },
            {
              label: "Valor",
              name: "amount",
              filterId: "amount",
              render: (r) => {
                const positive = r.type === 1 || r.type === 5;
                return (
                  <span className={cn(positive ? "text-positive" : "text-negative", "tabular-nums")}>
                    {positive ? "+" : "−"} {formatMoney(r.amount)}
                  </span>
                );
              },
            },
            { label: "Forma Pagamento", name: "payment_method", filterId: "payment_method", render: (r) => r.payment_method_name ?? "—" },
            { label: "Categoria", name: "category", filterId: "category", render: (r) => r.category_name ?? "—" },
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
          summary: (rows) => <TransactionsSummary rows={rows} />,
          keepOpen: true,
          load,
          create: transactionApi.create,
          update: (id, d) => transactionApi.update(id, d),
          remove: transactionApi.remove,
          empty: (): TransactionInput => ({
            description: "", amount: 0, type: 2, date: todayISO(),
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
          filters: [
            {
              id: "type", label: "Tipo", field: "select",
              options: [
                { label: "Receita", value: 1 },
                { label: "Despesa", value: 2 },
                { label: "Fatura", value: 3 },
                { label: "Reserva (Adição)", value: 4 },
                { label: "Reserva (Remoção)", value: 5 },
              ],
              accessor: (r) => r.type,
            },
            { id: "category", label: "Categoria", field: "select", accessor: (r) => r.category_name },
            { id: "payment_method", label: "Forma Pgto", field: "select", accessor: (r) => r.payment_method_name },
            { id: "date", label: "Data", field: "date", accessor: (r) => r.date },
            { id: "amount", label: "Valor", field: "money", accessor: (r) => r.amount },
          ],
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

function TransactionsSummary({ rows }: { rows: TransactionRow[] }) {
  const income = rows
    .filter((r) => r.type === 1 || r.type === 5)
    .reduce((s, r) => s + r.amount, 0);
  const expense = rows
    .filter((r) => r.type === 2 || r.type === 3 || r.type === 4)
    .reduce((s, r) => s + r.amount, 0);
  const saldo = income - expense;
  return (
    <div className="grid grid-cols-3 gap-3">
      <SummaryTile label="Receitas" value={formatMoney(income)} className="text-positive" />
      <SummaryTile label="Despesas" value={formatMoney(expense)} className="text-negative" />
      <SummaryTile
        label="Saldo do mês"
        value={formatMoney(saldo)}
        className={saldo >= 0 ? "text-positive" : "text-negative"}
      />
    </div>
  );
}

function SummaryTile({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card className="flex flex-col gap-0.5 px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-lg font-bold tabular-nums", className)}>{value}</span>
    </Card>
  );
}
