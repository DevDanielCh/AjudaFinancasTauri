"use client";
import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CrudPage } from "@/components/crud/CrudPage";
import { TransacaoAddForm } from "./TransacaoAddForm";
import { transactionApi } from "../../Repositories/transaction";
import { categoryApi } from "../../Repositories/category";
import { paymentMethodApi } from "../../Repositories/payment-method";
import { msg } from "@/src/shared/repository";
import { dashboardKeys } from "@/src/shared/services";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useMonth } from "@/lib/month-context";
import { transactionKeys } from "../../Services/transaction";
import { transactionSchema } from "@/lib/schemas";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import type { Sort } from "@/src/shared/models";
import type { CardBillDetail, TransactionInput, TransactionRow } from "../../Models/transaction";

export function TransacaoViewForm({ id, onClose }: { id: number | null; onClose: () => void }) {
  const isMobile = useIsMobile();
  const { month } = useMonth();
  const [detail, setDetail] = useState<CardBillDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
    setError(null);
    transactionApi
      .getCardBill(id)
      .then(setDetail)
      .catch((e) => setError(msg(e)));
  }, [id, reload]);

  const load = useCallback(
    (sort: Sort | null) => {
      if (!id) return Promise.resolve<TransactionRow[]>([]);
      return transactionApi
        .listCardBillTransactions(id, sort)
        .then((d) => {
          setDetail((prev) => (prev ? { ...prev, ...d } : d));
          return d.transactions;
        });
    },
    [id],
  );

  const renderBody = (showHeaderClose: boolean) => (
    <>
      <DialogHeader showCloseButton={showHeaderClose}>
        <DialogTitle>{detail?.description ?? "Carregando..."}</DialogTitle>
      </DialogHeader>
      {error && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      )}
      {!error && (
        <div className="flex min-h-0 flex-1 flex-col">
          {detail && (
            <div className="mb-3 grid grid-cols-3 gap-3">
              <Card className="flex flex-col gap-0.5 px-4 py-3">
                <span className="text-xs text-muted-foreground">Período</span>
                <span className="text-sm font-bold">
                  {formatDate(detail.period_start)} a {formatDate(detail.period_end)}
                </span>
              </Card>
              <Card className="flex flex-col gap-0.5 px-4 py-3">
                <span className="text-xs text-muted-foreground">Vencimento</span>
                <span className="text-sm font-bold">{formatDate(detail.due_date)}</span>
              </Card>
              <Card className="flex flex-col gap-0.5 px-4 py-3">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-lg font-bold text-negative tabular-nums">
                  {formatMoney(detail.total)}
                </span>
              </Card>
            </div>
          )}
          <CrudPage
            config={{
              title: "Compras da Fatura",
              addLabel: "Nova Compra",
              newTitle: "Nova Compra",
              editTitle: "Editar Compra",
              columns: [
                { label: "Data", name: "date", render: (r) => formatDate(r.date) },
                {
                  label: "Descrição",
                  name: "description",
                  render: (r) => (
                    <span>
                      {r.description}
                      {r.installment && (
                        <span className="ml-1 text-xs text-muted-foreground">{r.installment}</span>
                      )}
                    </span>
                  ),
                },
                {
                  label: "Valor",
                  name: "amount",
                  render: (r) => (
                    <span className="text-negative tabular-nums">− {formatMoney(r.amount)}</span>
                  ),
                },
              ],
              mobileCorners: {
                topLeft: (r) => r.description,
                bottomLeft: (r) => (r.installment ? `Parcela ${r.installment}` : r.category_name ?? "—"),
                topRight: (r) => (
                  <span className="text-negative tabular-nums">− {formatMoney(r.amount)}</span>
                ),
                bottomRight: (r) => formatDate(r.date),
              },
              keepOpen: false,
              onSaved: () => setReload((n) => n + 1),
              load,
              create: transactionApi.create,
              update: (bid, d) => transactionApi.update(bid, d),
              remove: transactionApi.remove,
              empty: (): TransactionInput => ({
                description: "",
                amount: 0,
                type: 2,
                date: todayISO(),
                category_id: null,
                payment_method_id: detail?.payment_method_id ?? null,
                card_mode: 0,
              }),
              toInput: (r): TransactionInput => ({
                description: r.description,
                amount: r.amount,
                type: r.type as 1 | 2 | 4 | 5,
                date: r.date,
                category_id: r.category_id,
                payment_method_id: r.payment_method_id,
                card_mode: r.card_mode,
              }),
              protected: () => false,
              tableClassName: "table-scroll-flex",
              loadResources: async () => {
                const [categories, paymentMethods] = await Promise.all([
                  categoryApi.list(),
                  paymentMethodApi.list(),
                ]);
                return { categories, paymentMethods };
              },
              FormFields: TransacaoAddForm,
              queryKey: ["card-bill", id, "transactions"],
              invalidate: [["card-bill"], transactionKeys(month), dashboardKeys(month)],
              schema: transactionSchema,
            }}
          />
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent side="bottom" showCloseButton className="flex h-[92dvh] flex-col overflow-hidden p-0">
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">{renderBody(false)}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">{renderBody(true)}</div>
      </DialogContent>
    </Dialog>
  );
}
