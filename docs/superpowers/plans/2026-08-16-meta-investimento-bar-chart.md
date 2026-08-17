# Meta de Investimento → Bar Chart

**Goal:** Substituir o card de texto do MetaCard por um bar chart comparando meta-alvo vs aportes do mês.

**File:** `app/page.tsx` — função `MetaCard`

## Approach

Usar `@tanstack/charts` (já no projeto) com `barY` + `group` layout.Dois bars agrupados: "Meta" (valor-alvo) e "Aportes" (valor realizado).

## Data

```ts
const metaValor = Math.round((income * pct) / 100);
const chartData = [
  { series: "Meta", value: metaValor },
  { series: "Aportes", value: aportes },
];
```

## Chart Config

```ts
const COLORS = { Meta: "hsl(var(--muted-foreground) / 0.35)", Aportes: "hsl(var(--chart-2))" };

defineChart({
  marks: [
    barY(data, {
      x: "series",
      y: "value",
      color: "series",
      layout: group(),
      radius: 4,
      inset: 8,
    }),
  ],
  x: { padding: 0.4 },
  y: { scale: scaleLinear, nice: true, grid: true, axis: { ticks: { format: formatMoney } } },
  color: { domain: ["Meta", "Aportes"], range: [COLORS.Meta, COLORS.Aportes] },
});
```

## UI Layout

```
┌──────────────────────────────────────────┐
│ Meta de investimento     [Meta batida]   │
│ ┌──────────────────────────────────────┐ │
│ │  ████  (Meta: R$ 1.000)             │ │
│ │  ████████████  (Aportes: R$ 1.500)  │ │
│ └──────────────────────────────────────┘ │
│ 20% da renda · aportado R$ 1.500        │
└──────────────────────────────────────────┘
```

## Steps

1. Editar `MetaCard` em `app/page.tsx`:
   - Adicionar imports: `barY`, `group` de `@tanstack/charts`, `scaleLinear` de `@tanstack/charts/scales/linear`, `Chart` de `@tanstack/charts/react`
   - Substituir conteúdo de `<CardContent>` por chart + texto abaixo
   - Manter badge no header
2. `bun run typecheck` + `bun run lint`
3. Commit
