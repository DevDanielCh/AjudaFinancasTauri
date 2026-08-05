"use client";
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { CardBillDetail } from "@/lib/types";

export function FaturaDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const [detail, setDetail] = useState<CardBillDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
    api.getCardBill(id).then(setDetail).catch(() => onClose());
  }, [id, onClose]);

  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{detail?.description ?? "Carregando..."}</DialogTitle>
        </DialogHeader>
        {detail && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap gap-4">
              <span>Período: <b>{formatDate(detail.period_start)} a {formatDate(detail.period_end)}</b></span>
              <span>Vencimento: <b>{formatDate(detail.due_date)}</b></span>
              <span>Total: <b>{formatMoney(detail.total)}</b></span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.transactions.length === 0 ? (
                    <TableRow><TableCell colSpan={3}>Nenhuma compra no período</TableCell></TableRow>
                ) : (
                  detail.transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.date)}</TableCell>
                      <TableCell>
                        {t.description}
                        {t.installment && (
                          <span className="ml-1 text-xs text-muted-foreground">{t.installment}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(t.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
