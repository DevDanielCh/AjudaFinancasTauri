"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { formatMoney } from "@/lib/format";

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{formatMoney(value)}</span>
    </div>
  );
}

export function RendaCard({ income }: { income: number }) {
  const [desejado, setDesejado] = useState(income);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Viver de Renda</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">
            Valor Mensal Desejado de Renda
          </label>
          <MoneyInput value={desejado} onChange={setDesejado} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Row label="Valor Total Investido Necessário" value={desejado * 150} />
          <Row label="Valor de Aporte Mensal Necessário" value={Math.round(desejado * 0.2)} />
          <Row label="Valor de Reserva de Emergência" value={desejado * 6} />
          <Row label="Valor Máximo de Gasto Fixo Mensal" value={Math.round(desejado / 2)} />
          <Row label="Valor Máximo de Gasto com Lazer" value={Math.round(desejado * 0.1)} />
        </div>
      </CardContent>
    </Card>
  );
}