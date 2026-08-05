"use client";
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api, msg } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useMonth } from "@/lib/month-context";
import { cn } from "@/lib/utils";
import type { LoanDetail } from "@/lib/types";

export function DetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { month } = useMonth();
  const [detail, setDetail] = useState<LoanDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
    api.getLoanDetail(id).then(setDetail).catch((e) => msg(e));
  }, [id]);

  const totalPaid = detail?.schedule.reduce((s, r) => s + r.installment, 0) ?? 0;

  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {detail?.loan.description ?? "Carregando..."}
          </DialogTitle>
        </DialogHeader>
        {detail && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap gap-4">
              <span>Valor: <b>{formatMoney(detail.loan.principal)}</b></span>
              <span>Parcela: <b>{formatMoney(detail.loan.installment)}</b></span>
              <span>Total: <b>{formatMoney(totalPaid)}</b></span>
              <span>Juros: <b>{formatMoney(totalPaid - detail.loan.principal)}</b></span>
              <span>Parcelas: <b>{detail.loan.paid_count}/{detail.loan.total_installments}</b></span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Parcela</TableHead>
                  <TableHead className="text-right">Juros</TableHead>
                  <TableHead className="text-right">Amortização</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.schedule.map((r) => {
                  const paid = r.month < month;
                  return (
                    <TableRow key={r.number} className={cn(paid && "opacity-50")}>
                      <TableCell className={cn(paid && "text-muted-foreground line-through")}>
                        {r.number}
                      </TableCell>
                      <TableCell className={cn(paid && "text-muted-foreground line-through")}>
                        {r.month}
                      </TableCell>
                      <TableCell className={cn("text-right", paid && "text-muted-foreground line-through")}>
                        {formatMoney(r.installment)}
                      </TableCell>
                      <TableCell className={cn("text-right", paid && "text-muted-foreground line-through")}>
                        {formatMoney(r.interest)}
                      </TableCell>
                      <TableCell className={cn("text-right", paid && "text-muted-foreground line-through")}>
                        {formatMoney(r.principal)}
                      </TableCell>
                      <TableCell className={cn("text-right", paid && "text-muted-foreground line-through")}>
                        {formatMoney(r.balance)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
