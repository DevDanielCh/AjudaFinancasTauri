"use client";
import { useCallback } from "react";
import { CrudPage } from "@/components/crud/CrudPage";
import { ReservaAddForm } from "@/src/Investimentos/Views/Reserva/ReservaAddForm";
import { ReservaViewForm } from "@/src/Investimentos/Views/Reserva/ReservaViewForm";
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
import { formatDate, formatMoney, todayISO } from "@/lib/format";
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
          <span className={cn("text-lg font-semibold tabular-nums", saldo < 0 ? "text-negative" : "text-positive")}>
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
        newTitle: "Novo Aporte/Resgate",
        editTitle: "Editar Aporte/Resgate",
        columns: [
          { label: "Data", render: (r) => formatDate(r.date) },
          {
            label: "Tipo",
            render: (r) =>
              r.type === 5
                ? <Badge variant="negative">Remoção</Badge>
                : <Badge variant="positive">Adição</Badge>,
          },
          { label: "Descrição", render: (r) => r.description },
          {
            label: "Valor",
            render: (r) => {
              const positive = r.type === 4;
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
          bottomLeft: (r) => (r.type === 5 ? "Remoção" : "Adição"),
          topRight: (r) => {
            const positive = r.type === 4;
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
        create: (d: ReservaInput) =>
          transactionApi.create({ ...d, category_id: null, payment_method_id: null, card_mode: 0 }),
        update: (id, d: ReservaInput) =>
          transactionApi.update(id, { ...d, category_id: null, payment_method_id: null, card_mode: 0 }),
        remove: transactionApi.remove,
        empty: (): ReservaInput => ({
          description: "", amount: 0, type: 4, date: todayISO(),
        }),
        toInput: (r): ReservaInput => ({ description: r.description, amount: r.amount, type: r.type, date: r.date }),
        summary: balance,
        queryKey: reservaKeys,
        invalidate: [
          dashboardKeys(month),
          chartKeys(null),
          transactionKeys(month),
          ["card-bill"],
        ],
        schema: reservaSchema,
        FormFields: ReservaAddForm,
        ViewFields: ReservaViewForm,
      }}
    />
  );
}
