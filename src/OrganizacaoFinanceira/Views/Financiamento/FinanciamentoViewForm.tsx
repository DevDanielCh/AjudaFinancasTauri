"use client";
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { loanApi } from "../../Repositories/loan";
import { msg } from "@/src/shared/repository";
import { useIsMobile } from "@/lib/use-is-mobile";
import { formatDate, formatMoney } from "@/lib/format";
import { useMonth } from "@/lib/month-context";
import { cn } from "@/lib/utils";
import type { LoanDetail } from "../../Models/loan";

export function FinanciamentoViewForm({ id, onClose }: { id: number | null; onClose: () => void }) {
  const isMobile = useIsMobile();
  const { month } = useMonth();
  const [detail, setDetail] = useState<LoanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
    setError(null);
    loanApi.getDetail(id).then(setDetail).catch((e) => setError(msg(e)));
  }, [id]);

  const dueDate = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    const day = Math.min(detail!.loan.day, new Date(y, m, 0).getDate());
    return formatDate(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  };

  const totalPaid = detail?.schedule.reduce((s, r) => s + r.installment, 0) ?? 0;

  const renderBody = (showHeaderClose: boolean) => (
    <>
      <DialogHeader showCloseButton={showHeaderClose}>
        <DialogTitle>
          {detail?.loan.description ?? "Carregando..."}
        </DialogTitle>
      </DialogHeader>
      {error && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => setError(null)}>Fechar</Button>
        </div>
      )}
      {detail && (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap gap-4">
            <span>Valor: <b className="tabular-nums">{formatMoney(detail.loan.principal)}</b></span>
            <span>Parcela: <b className="tabular-nums">{formatMoney(detail.loan.installment)}</b></span>
            <span>Total: <b className="tabular-nums">{formatMoney(totalPaid)}</b></span>
            <span>Juros: <b className="tabular-nums">{formatMoney(totalPaid - detail.loan.principal)}</b></span>
            <span>Parcelas: <b className="tabular-nums">{detail.loan.paid_count}/{detail.loan.total_installments}</b></span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Parcela</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Juros</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Amortização</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Liq. antecipada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.schedule.map((r) => {
                const paid = r.month < month;
                return (
                  <TableRow key={r.number} className={cn(paid && "opacity-50")}>
                    <TableCell className={cn(paid && "text-muted-foreground line-through")}>
                      {dueDate(r.month)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", paid && "text-muted-foreground line-through")}>
                      {formatMoney(r.installment)}
                    </TableCell>
                    <TableCell className={cn("hidden text-right tabular-nums sm:table-cell", paid && "text-muted-foreground line-through")}>
                      {formatMoney(r.interest)}
                    </TableCell>
                    <TableCell className={cn("hidden text-right tabular-nums sm:table-cell", paid && "text-muted-foreground line-through")}>
                      {formatMoney(r.principal)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", paid && "text-muted-foreground line-through")}>
                      {formatMoney(r.balance)}
                    </TableCell>
                    <TableCell className={cn("hidden text-right tabular-nums sm:table-cell", paid && "text-muted-foreground line-through")}>
                      {r.settlement > 0 ? formatMoney(r.settlement) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent side="bottom" showCloseButton className="max-h-[90dvh] overflow-y-auto">
          <div className="px-4">{renderBody(false)}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {renderBody(true)}
      </DialogContent>
    </Dialog>
  );
}
