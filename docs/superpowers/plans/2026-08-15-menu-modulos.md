# Menu em Módulos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dividir a navegação em dois módulos — "Organização Financeira" e "Investimentos" — com cabeçalhos de seção no Sidebar (desktop) e no sheet "Mais" do BottomBar (mobile).

**Architecture:** Sem novas rotas. Apenas agrupamento visual: arrays `MODULE_GROUPS` em `Sidebar.tsx` e `MORE_GROUPS` em `BottomBar.tsx`, renderizados com label de seção. Dashboard e Configurações ficam fora dos módulos (Dashboard no topo, Configurações junto ao botão de tema / seção Sistema).

**Tech Stack:** Next.js App Router, lucide-react, shadcn/ui (`Separator`).

**Decisão de negócio:** "Investimentos" hoje contém apenas Reserva ("Investimentos e reserva de emergência"). "Organização Financeira" contém o resto das entidades. Configurações = seção própria "Sistema".

---

### Task 1: Sidebar desktop com seções

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Estruturar NAV em grupos**

Substituir `const NAV = [...]` (linhas 17-26) por:
```tsx
const MODULE_GROUPS = [
  {
    label: "Organização Financeira",
    items: [
      { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
      { href: "/fixed-bills", label: "Contas Fixas", icon: RefreshCw },
      { href: "/installments", label: "Parcelamentos", icon: CalendarClock },
      { href: "/loans", label: "Financiamentos", icon: Landmark },
      { href: "/payment-methods", label: "Formas de Pagamento", icon: CreditCard },
      { href: "/categories", label: "Categorias", icon: Tags },
    ],
  },
  {
    label: "Investimentos",
    items: [
      { href: "/reserva", label: "Reserva", icon: PiggyBank },
    ],
  },
] as const;
```

- [ ] **Step 2: Renderizar seções**

Substituir o `<nav className="flex flex-1 flex-col gap-1">...</nav>` (linhas 56-73) por:
```tsx
<nav className="flex flex-1 flex-col gap-3">
  {MODULE_GROUPS.map((group) => (
    <div key={group.label} className="flex flex-col gap-1">
      <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {group.label}
      </p>
      {group.items.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
              active && "bg-accent"
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </div>
  ))}
</nav>
```
Configurações permanece no Link atual (abaixo do `<nav>`), sem agrupamento — a linha `import { ... Settings ... }` e o item Configurações continuam no lugar.

- [ ] **Step 3: Limpar imports não usados**

Remover do import de `lucide-react` os ícones que saíram de uso no Sidebar, se sobrarem sem referência (manter os usados em `MODULE_GROUPS`, `Moon`, `Sun`, `Settings`, `LayoutDashboard`). `ArrowLeftRight`, `CalendarClock`, `CreditCard`, `Landmark`, `PiggyBank`, `RefreshCw`, `Tags` continuam usados.

- [ ] **Step 4: Verificação**

Run: `bun run lint` e `bun run typecheck`
Expected: sem erros (lint acusa import não usado — remover o que sobrar).

- [ ] **Step 5: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: sidebar agrupado em módulos de navegação"
```

---

### Task 2: BottomBar mobile com seções no sheet "Mais"

**Files:**
- Modify: `components/BottomBar.tsx`

- [ ] **Step 1: Estruturar MORE em grupos**

Substituir `const MORE = [...]` (linhas 18-25) por:
```tsx
const MORE_GROUPS = [
  {
    label: "Organização Financeira",
    items: [
      { href: "/payment-methods", label: "Formas de Pagamento", icon: CreditCard },
      { href: "/categories", label: "Categorias", icon: Tags },
      { href: "/fixed-bills", label: "Contas Fixas", icon: Receipt },
      { href: "/loans", label: "Financiamentos", icon: Banknote },
    ],
  },
  {
    label: "Investimentos",
    items: [
      { href: "/reserva", label: "Reserva", icon: PiggyBank },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
] as const;
```

- [ ] **Step 2: Renderizar grupos**

Substituir o map de `MORE` dentro do `SheetContent` (linhas 69-82) por:
```tsx
{MORE_GROUPS.map((group) => (
  <div key={group.label} className="flex flex-col">
    <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {group.label}
    </p>
    {group.items.map(({ href, label, icon: Icon }) => (
      <Link
        key={href}
        href={href}
        onClick={() => setOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-accent",
          pathname.startsWith(href) && "bg-accent"
        )}
      >
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </Link>
    ))}
  </div>
))}
```

- [ ] **Step 3: Verificação**

Run: `bun run lint` e `bun run typecheck`
Expected: sem erros.

- [ ] **Step 4: Teste manual**

Run: `bun run dev`
Sidebar (≥sm): ver "Organização Financeira" e "Investimentos" como cabeçalhos; itens corretos sob cada um. Mobile (<sm): abrir "…" no bottom bar, ver os 3 grupos. Navegar por cada item funciona.

- [ ] **Step 5: Commit**

```bash
git add components/BottomBar.tsx
git commit -m "feat: menu mobile agrupado em módulos"
```

---

### Task 3: Self-review

- [ ] **Step 1: Checklist da spec**

- [ ] Dois menus/labels: "Organização Financeira" e "Investimentos" (TODO #3)
- [ ] Itens correspondentes em cada módulo
- [ ] Desktop (Sidebar) e mobile (BottomBar) consistentes
- [ ] Dashboard e Configurações acessíveis

- [ ] **Step 2: Build**

Run: `bun run build`
Expected: limpo.
