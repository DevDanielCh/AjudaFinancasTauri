"use client";

import * as React from "react";
import { defineChart, lineY } from "@tanstack/charts";
import { fold } from "@tanstack/charts/transform/fold";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { Chart } from "@tanstack/charts/react";
import { tooltip } from "@tanstack/charts/tooltip";
import { pie, polar, radialArc } from "@tanstack/charts/polar";
import type { BreakdownRow, ChartData } from "@/src/shared/models";
import { formatMoney, formatMonth } from "@/lib/format";
import {
  Card, CardAction, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";

// Cores do design system (DESIGN.md): verde/vermelho semânticos, azul estrutural, reserva em gold.
const TREND_COLORS = { income: "#1aae39", expenses: "#dc2626", balance: "#0075de", reserva: "#FFD700" };
const TREND_LABEL = { income: "Receitas", expenses: "Despesas", balance: "Saldo", reserva: "Reserva" } as const;
// ponytail: backend não expõe cor por categoria; paleta fixa cicla por índice.
const DONUT_COLORS = [
  "#62aef0", "#d6b6f6", "#ff64c8", "#dd5b00", "#2a9d99",
  "#1aae39", "#391c57", "#793400", "#0075de", "#523410",
];

export function ChartSection({ data, month }: { data: ChartData; month: string }) {
  const folded = React.useMemo(() => {
    const f = fold(data.monthly, {
      fields: ["income", "expenses", "balance", "reserva"] as const,
      as: { key: "series", value: "amount" },
    });
    return f.map((r) => ({ ...r, series: TREND_LABEL[r.series as keyof typeof TREND_LABEL] }));
  }, [data.monthly]);

  const selectedIncome = data.monthly.find((p) => p.month === month)?.income ?? 0;

  const trend = React.useMemo(
    () =>
      defineChart({
        marks: [lineY(folded, { x: "month", y: "amount", color: "series", points: true })],
        x: {
          scale: () => scalePoint<string>().padding(0.2),
          axis: { ticks: { format: (v) => formatMonth(String(v)) } },
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: { ticks: { format: (v) => formatMoney(Number(v)) } },
        },
        focus: "group-x",
        tooltip: {
          use: tooltip,
          formatGroup: (points) => {
            const heading = formatMonth(String(points[0]?.xValue ?? ""));
            return [
              heading,
              ...points.map(
                (p) =>
                  `${String(p.datum.series)}: ${formatMoney(Number(p.datum.amount))}`
              ),
            ].join("\n");
          },
        },
        color: {
          domain: Object.values(TREND_LABEL),
          range: Object.values(TREND_COLORS),
        },
      }),
    [folded]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Evolução</CardTitle>
          <CardAction>
            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-hidden>
              {Object.entries(TREND_LABEL).map(([key, label]) => (
                <li key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: TREND_COLORS[key as keyof typeof TREND_COLORS] }}
                  />
                  {label}
                </li>
              ))}
            </ul>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Chart definition={trend} height={260} ariaLabel="Evolução mensal de receitas, despesas, saldo e reserva" />
        </CardContent>
      </Card>
      <DonutCard title="Despesas por categoria" rows={data.expenses_by_cat} income={selectedIncome} />
      <DonutCard title="Despesas por forma de pagamento" rows={data.expenses_by_pm} income={selectedIncome} />
    </div>
  );
}

function DonutCard({ title, rows, income }: { title: string; rows: BreakdownRow[]; income: number }) {
  const definition = React.useMemo(() => {
    const slices = pie(rows, { value: "total" });
    return defineChart({
      marks: [
        polar({
          inset: 8,
          radiusRatio: 0.82,
          marks: [
            radialArc(slices, {
              innerRadius: ({ radius }) => radius * 0.58,
              cornerRadius: 4,
              color: "name",
              key: "name",
            }),
          ],
        }),
      ],
      color: {
        domain: rows.map((r) => r.name),
        range: rows.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length]),
      },
      tooltip: {
        use: tooltip,
        format: (point) => {
          const total = Number(point.datum.total);
          const pct = income > 0 ? `${((total / income) * 100).toFixed(1).replace(".", ",")}%` : null;
          return `${point.datum.name}: ${formatMoney(total)}${pct ? ` (${pct} da renda)` : ""}`;
        },
      },
    });
  }, [rows, income]);

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sem despesas no mês.</p>
        ) : (
          <>
            <Chart definition={definition} height={220} ariaLabel={title} />
            <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {rows.map((r, i) => (
                <li key={r.name} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    />
                    <span className="truncate">{r.name}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">{formatMoney(r.total)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
