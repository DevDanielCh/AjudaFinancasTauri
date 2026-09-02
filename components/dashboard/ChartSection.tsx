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
import { useTheme } from "next-themes";
import {
  Card, CardAction, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";

// Cores do design system (DESIGN.md): resolvidas dos tokens CSS (adaptam ao dark mode).
// Fallbacks sao os valores do tema claro, usados antes do tema montar.
function token(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const TREND_LABEL = { income: "Receitas", expenses: "Despesas", balance: "Saldo", reserva: "Reserva" } as const;

// Cores fixas do gráfico de evolução (DESIGN.md): Receita verde, Despesa vermelho,
// Saldo azul, Reserva dourado. Independentes de tema — nunca mudam.
const TREND_COLORS = {
  income: "#16a34a",
  expenses: "#dc2626",
  balance: "#2563eb",
  reserva: "#d4a017",
} as const;

function useChartColors() {
  const { resolvedTheme } = useTheme();
  return React.useMemo(() => {
    void resolvedTheme;
    // ler tokens de novo a cada troca de tema
    const trend = { ...TREND_COLORS };
    const donut = [
      token("--color-chart-1", "#62aef0"),
      token("--color-chart-2", "#d6b6f6"),
      token("--color-chart-3", "#ff64c8"),
      token("--color-chart-4", "#dd5b00"),
      token("--color-chart-5", "#2a9d99"),
      token("--color-positive", "#1aae39"),
      token("--color-sticker-purple-deep", "#391c57"),
      token("--color-sticker-orange-deep", "#793400"),
      token("--color-primary", "#0075de"),
      token("--color-sticker-brown", "#523410"),
    ];
    return { trend, donut };
  }, [resolvedTheme]);
}

export function ChartSection({ data, month }: { data: ChartData; month: string }) {
  const colors = useChartColors();
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
          range: Object.values(colors.trend),
        },
      }),
    [folded, colors.trend]
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
                    style={{ backgroundColor: colors.trend[key as keyof typeof colors.trend] }}
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
  const colors = useChartColors();
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
        range: rows.map((r, i) => r.color ?? colors.donut[i % colors.donut.length]),
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
  }, [rows, income, colors.donut]);

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
                      style={{ backgroundColor: r.color ?? colors.donut[i % colors.donut.length] }}
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
