"use client";
import { useCallback } from "react";
import { CrudPage } from "@/components/crud/CrudPage";
import { ReservaForm } from "@/components/forms/ReservaForm";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useMonth } from "@/lib/month-context";
import { api } from "@/lib/api";
import { queryKeys, useSettings } from "@/lib/queries";
import { reservaSchema } from "@/lib/schemas";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReservaInput, TransactionRow } from "@/lib/types";

export default function ReservaPage() {
  const { month } = useMonth();
  const { data: settings } = useSettings();
  const seed = settings?.saldo_inicial_reserva ?? 0;
  const load = useCallback(() => api.listReservaMovements(), []);

  const balance = useCallback(
    (rows: TransactionRow[]) => {
      const saldo = seed + rows.reduce((acc, r) => acc + (r.type === 5 ? -r.amount : r.amount), 0);
      return (
        <Card className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">Saldo da reserva</span>
          <span className={cn("text-lg font-semibold font-mono", saldo < 0 ? "text-negative" : "text-positive")}>
            {formatMoney(saldo)}
          </span>
        </Card>
      );
    },
    [seed]
  );

  return (
    <CrudPage
      config={{
        title: "Reservas",
        description: "Investimentos e reserva de emergência",
        columns: [
          { header: "Data", render: (r) => formatDate(r.date) },
          {
            header: "Tipo",
            render: (r) =>
              r.type === 5
                ? <Badge className="bg-negative text-negative-foreground">Remoção</Badge>
                : <Badge className="bg-positive text-positive-foreground">Adição</Badge>,
          },
          { header: "Descrição", render: (r) => r.description },
          {
            header: "Valor",
            render: (r) => {
              const positive = r.type === 4;
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
          bottomLeft: (r) => (r.type === 5 ? "Remoção" : "Adição"),
          topRight: (r) => {
            const positive = r.type === 4;
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
        create: (d: ReservaInput) =>
          api.createTransaction({ ...d, category_id: null, payment_method_id: null, card_mode: 0 }),
        update: (id, d: ReservaInput) =>
          api.updateTransaction(id, { ...d, category_id: null, payment_method_id: null, card_mode: 0 }),
        remove: api.deleteTransactions,
        empty: (): ReservaInput => ({
          description: "", amount: 0, type: 4, date: new Date().toISOString().slice(0, 10),
        }),
        toInput: (r): ReservaInput => ({ description: r.description, amount: r.amount, type: r.type, date: r.date }),
        summary: balance,
        protectedDeleteMessage: "Movimentações de reserva protegidas",
        queryKey: queryKeys.reserva,
        invalidate: [
          queryKeys.dashboard(month),
          queryKeys.chart(null),
          queryKeys.transactions(month),
          ["card-bill"],
        ],
        schema: reservaSchema,
        FormFields: ReservaForm,
      }}
    />
  );
}
