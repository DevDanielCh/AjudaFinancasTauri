"use client";

import * as React from "react";
import { defineChart, lineY } from "@tanstack/charts";
import { fold } from "@tanstack/charts/transform/fold";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { Chart } from "@tanstack/charts/react";
import { tooltip } from "@tanstack/charts/tooltip";
import { pie, polar, radialArc } from "@tanstack/charts/polar";
import type { ChartData } from "@/lib/types";
import { formatMoney, formatMonth } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TREND_COLORS = { income: "#22c55e", expenses: "#ef4444", balance: "#6366f1" };
const TREND_LABEL = { income: "Receitas", expenses: "Despesas", balance: "Saldo" } as const;
// ponytail: backend não expõe cor por categoria; paleta fixa cicla por índice.
const DONUT_COLORS = [
  "#0ea5e9", "#6366f1", "#a855f7", "#ec4899", "#f97316", "#14b8a6",
  "#84cc16", "#f43f5e", "#06b6d4", "#8b5cf6",
];

export function ChartSection({ data }: { data: ChartData }) {
  const folded = React.useMemo(
    () =>
      fold(data.monthly, {
        fields: ["income", "expenses", "balance"] as const,
        as: { key: "series", value: "amount" },
      }),
    [data.monthly]
  );

  const trend = React.useMemo(
    () =>
      defineChart({
        marks: [lineY(folded, { x: "month", y: "amount", color: "series", points: true })],
        x: {
          scale: () => scalePoint<string>().padding(0.2),
          axis: { ticks: { format: (v) => formatMonth(String(v)) } },
        },
        y: {
          scale: scaleLinear(),
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
                  `${TREND_LABEL[p.datum.series as keyof typeof TREND_LABEL] ?? p.groupLabel}: ${formatMoney(Number(p.datum.amount))}`
              ),
            ].join("\n");
          },
        },
        color: { domain: Object.keys(TREND_COLORS), range: Object.values(TREND_COLORS) },
      }),
    [folded]
  );

  const donut = React.useMemo(() => {
    const rows = data.expenses_by_cat.map((r) => ({ name: r.name, total: r.total }));
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
        format: (point) => `${point.datum.name}: ${formatMoney(Number(point.datum.total))}`,
      },
    });
  }, [data.expenses_by_cat]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Evolução</CardTitle></CardHeader>
        <CardContent>
          <Chart definition={trend} height={260} ariaLabel="Evolução mensal de receitas, despesas e saldo" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Despesas por categoria</CardTitle></CardHeader>
        <CardContent>
          {data.expenses_by_cat.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem despesas no mês.</p>
          ) : (
            <>
              <Chart definition={donut} height={220} ariaLabel="Despesas por categoria" />
              <ul className="mt-3 space-y-1 text-sm">
                {data.expenses_by_cat.map((r, i) => (
                  <li key={r.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                      />
                      {r.name}
                    </span>
                    <span className="text-muted-foreground">{formatMoney(r.total)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
