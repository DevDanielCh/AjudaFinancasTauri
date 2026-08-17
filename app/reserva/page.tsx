"use client";
import { useCallback } from "react";
import { CrudPage } from "@/components/crud/CrudPage";
import { ReservaAddForm } from "@/src/Investimentos/Views/Reserva/ReservaAddForm";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useMonth } from "@/lib/month-context";
import { transactionApi } from "@/src/OrganizacaoFinanceira/Repositories/transaction";
import { reservaApi } from "@/src/Investimentos/Repositories/reserva";
import { useSettings } from "@/src/shared/services";
import { reservaKeys } from "@/src/Investimentos/Services/reserva";
import { transactionKeys } from "@/src/OrganizacaoFinanceira/Services/transaction";
import { dashboardKeys, chartKeys } from "@/src/shared/services";
import { reservaSchema } from "@/lib/schemas";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReservaInput } from "@/src/Investimentos/Models/reserva";
import type { TransactionRow } from "@/src/OrganizacaoFinanceira/Models/transaction";

export default function ReservaPage() {
  const { month } = useMonth();
  const { data: settings } = useSettings();
  const seed = settings?.saldo_inicial_reserva ?? 0;
  const load = useCallback(() => reservaApi.listMovements(), []);

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
          { label: "Data", render: (r) => formatDate(r.date) },
          {
            label: "Tipo",
            render: (r) =>
              r.type === 5
                ? <Badge className="bg-negative text-negative-foreground">Remoção</Badge>
                : <Badge className="bg-positive text-positive-foreground">Adição</Badge>,
          },
          { label: "Descrição", render: (r) => r.description },
          {
            label: "Valor",
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
          transactionApi.create({ ...d, category_id: null, payment_method_id: null, card_mode: 0 }),
        update: (id, d: ReservaInput) =>
          transactionApi.update(id, { ...d, category_id: null, payment_method_id: null, card_mode: 0 }),
        remove: transactionApi.remove,
        empty: (): ReservaInput => ({
          description: "", amount: 0, type: 4, date: new Date().toISOString().slice(0, 10),
        }),
        toInput: (r): ReservaInput => ({ description: r.description, amount: r.amount, type: r.type, date: r.date }),
        summary: balance,
        protectedDeleteMessage: "Movimentações de reserva protegidas",
        queryKey: reservaKeys,
        invalidate: [
          dashboardKeys(month),
          chartKeys(null),
          transactionKeys(month),
          ["card-bill"],
        ],
        schema: reservaSchema,
        FormFields: ReservaAddForm,
      }}
    />
  );
}
