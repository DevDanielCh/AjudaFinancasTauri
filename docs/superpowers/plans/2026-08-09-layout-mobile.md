# Layout Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar layout mobile responsivo (bottom bar glass flutuante, header com mês, cards no lugar de tabelas, bottom sheets) ao app Tauri Android, mantendo o desktop intacto.

**Architecture:** Breakpoint único `sm` (640px). Mobile = shell novo (`MobileHeader`, `BottomBar`, `MoreSheet`) + `CardList` no lugar de `DataTable` dentro de `CrudPage` + dialogs virando bottom sheets. `CrudConfig` ganha `mobileCorners` opcional pra mapear os 4 cantos do card. Decisão mobile/desktop centralizada no hook `useIsMobile`. Zero mudança em `lib/api`, `lib/types`, `src-tauri`.

**Tech Stack:** Next.js 16, React 19, Tailwind, base-ui (`Dialog`, `Sheet`, `Drawer`), lucide-react, `@/components/ui/*` já existentes.

**Spec:** `docs/superpowers/specs/2026-08-09-layout-mobile-design.md`

**Verificação:** Projeto não tem test runner front-end. Verificação = `bun run typecheck` + `bun run lint` + `bun run build` + teste manual no celular (APK armv7). Toda task termina rodando typecheck/lint.

---

### Task 1: Hook useIsMobile

**Files:**
- Create: `lib/use-is-mobile.ts`
- Modify: `app/layout.tsx` (carregar nada ainda — só testar hook indiretamente)

- [ ] **Step 1: Criar o hook**

```ts
"use client";
import { useEffect, useState } from "react";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}
```

- [ ] **Step 2: Rodar typecheck**

Run: `bun run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/use-is-mobile.ts
git commit -m "feat: hook useIsMobile pra layout responsivo"
```

---

### Task 2: MonthPicker com variante compact

**Files:**
- Modify: `components/MonthPicker.tsx`

- [ ] **Step 1: Adicionar prop `compact`**

Substituir a prop no componente:

```tsx
export function MonthPicker({
  value, onChange, min, compact,
}: { value: string; onChange: (v: string) => void; min?: string; compact?: boolean }) {
```

E o botão trigger passa a ser condicional:

```tsx
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "font-normal",
              compact ? "justify-center gap-2 rounded-full px-3" : "w-full justify-between"
            )}
          >
            <span>{formatMonth(value)}</span>
            {!compact && <ChevronDown data-icon="inline-end" className="opacity-50" />}
          </Button>
        }
      />
```

- [ ] **Step 2: Typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/MonthPicker.tsx
git commit -m "feat: variante compact no MonthPicker pro header mobile"
```

---

### Task 3: MobileHeader

**Files:**
- Create: `components/MobileHeader.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MonthPicker } from "@/components/MonthPicker";
import { Button } from "@/components/ui/button";
import { useMonth } from "@/lib/month-context";
import { cn } from "@/lib/utils";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/transactions": "Transações",
  "/installments": "Parcelamentos",
  "/fixed-bills": "Contas Fixas",
  "/loans": "Financiamentos",
  "/categories": "Categorias",
  "/payment-methods": "Formas de Pagamento",
};

export function MobileHeader() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { month, setMonth, min } = useMonth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const title = TITLES[pathname] ?? "Ajuda Finanças";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md sm:hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <h1 className="truncate text-base font-bold tracking-tight">{title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <MonthPicker value={month} onChange={setMonth} min={min} compact />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Alternar tema"
          >
            {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: sem erros. Se `formatMonth` usado pelo MonthPicker não quebrar por caminho, ok.

- [ ] **Step 3: Commit**

```bash
git add components/MobileHeader.tsx
git commit -m "feat: header mobile com titulo, mes e tema"
```

---

### Task 4: BottomBar + MoreSheet

**Files:**
- Create: `components/BottomBar.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight, CalendarClock, Ellipsis, LayoutDashboard,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/installments", label: "Parcelamentos", icon: CalendarClock },
] as const;

const MORE = [
  { href: "/payment-methods", label: "Formas de Pagamento" },
  { href: "/categories", label: "Categorias" },
  { href: "/fixed-bills", label: "Contas Fixas" },
  { href: "/loans", label: "Financiamentos" },
] as const;

export function BottomBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-6 sm:hidden"
      >
        <div className="flex w-full max-w-xs items-center justify-between gap-1 rounded-full border border-background/60 bg-background/70 px-2 py-1.5 shadow-lg backdrop-blur-xl">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={cn(
                  "flex flex-1 items-center justify-center rounded-full py-2 text-muted-foreground transition-colors",
                  active && "bg-foreground text-background"
                )}
              >
                <Icon className="size-5" />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Mais"
            className="flex flex-1 items-center justify-center rounded-full py-2 text-muted-foreground"
          >
            <Ellipsis className="size-5" />
          </button>
        </div>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-1 pb-6">
          <SheetTitle className="px-4 pt-2 text-lg font-bold">Mais</SheetTitle>
          <div className="flex flex-col px-2">
            {MORE.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-3 text-sm font-medium hover:bg-accent",
                  pathname.startsWith(href) && "bg-accent"
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/BottomBar.tsx
git commit -m "feat: bottom bar glass flutuante com sheet de Mais"
```

---

### Task 5: Shell mobile no layout.tsx

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Adicionar MobileHeader e BottomBar, ocultar sidebar no mobile**

Substituir o bloco do body:

```tsx
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <MonthProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <MobileHeader />
                <main className="flex-1 p-3 pb-24 sm:pb-3">
                  {children}
                </main>
              </div>
              <BottomBar />
            </div>
            <Toaster />
            <UpdateDialog />
          </MonthProvider>
        </ThemeProvider>
      </body>
```

E adicionar import:

```tsx
import { MobileHeader } from "@/components/MobileHeader"
import { BottomBar } from "@/components/BottomBar"
```

No `components/Sidebar.tsx`, adicionar `hidden sm:flex` na classe do aside:

```tsx
    <aside className="hidden w-64 shrink-0 flex-col gap-2 border-r bg-muted/40 p-4 sm:flex">
```

- [ ] **Step 2: Typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: build concluído sem erro, `out/` gerado.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx components/Sidebar.tsx
git commit -m "feat: shell mobile com header e bottom bar no layout"
```

---

### Task 6: MobileCorners no CrudConfig + CardList

**Files:**
- Create: `components/crud/CardList.tsx`
- Modify: `components/crud/types.ts`

- [ ] **Step 1: Adicionar tipo MobileCorners em types.ts**

```ts
import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface MobileCorners<T> {
  topLeft: (row: T) => ReactNode;
  bottomLeft?: (row: T) => ReactNode;
  topRight?: (row: T) => ReactNode;
  bottomRight?: (row: T) => ReactNode;
}
```

- [ ] **Step 2: Criar CardList**

```tsx
"use client";
import { Inbox } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { MobileCorners } from "./types";

export function CardList<T extends { id: number }>({
  corners, rows, loading, onTap, onLongPress,
}: {
  corners: MobileCorners<T>;
  rows: T[];
  loading?: boolean;
  onTap?: (row: T) => void;
  onLongPress?: (row: T) => void;
}) {
  if (rows.length === 0) {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Spinner className="size-6" />
        </div>
      );
    }
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
          <EmptyTitle>Nenhum registro</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            className="w-full cursor-pointer rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent active:bg-accent"
            onClick={() => onTap?.(row)}
            onContextMenu={(e) => { e.preventDefault(); onLongPress?.(row); }}
            onPointerDown={(e) => {
              const t = setTimeout(() => onLongPress?.(row), 500);
              const cancel = () => { clearTimeout(t); };
              const onUp = () => { cancel(); cleanup(); };
              const onMove = () => { cancel(); cleanup(); };
              const cleanup = () => {
                window.removeEventListener("pointerup", onUp);
                window.removeEventListener("pointercancel", onMove);
                window.removeEventListener("pointermove", onMove);
              };
              window.addEventListener("pointerup", onUp);
              window.addEventListener("pointercancel", onMove);
              window.addEventListener("pointermove", onMove);
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{corners.topLeft(row)}</div>
                {corners.bottomLeft && (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {corners.bottomLeft(row)}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                {corners.topRight && (
                  <div className="truncate text-sm font-bold tabular-nums">
                    {corners.topRight(row)}
                  </div>
                )}
                {corners.bottomRight && (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {corners.bottomRight(row)}
                  </div>
                )}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add components/crud/types.ts components/crud/CardList.tsx
git commit -m "feat: CardList com toque e toque longo pra lista mobile"
```

---

### Task 7: CrudPage com CardList no mobile

**Files:**
- Modify: `components/crud/CrudPage.tsx`
- Create: `components/crud/CardOptionsSheet.tsx`

- [ ] **Step 1: Criar CardOptionsSheet**

```tsx
"use client";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

export function CardOptionsSheet<T extends { id: number }>({
  open, onOpenChange, row, title, canEdit, onView, onEdit, onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: T | null;
  title: (row: T) => string;
  canEdit: (row: T) => boolean;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="gap-1 pb-6">
        {row && (
          <>
            <SheetTitle className="px-4 pt-2">{title(row)}</SheetTitle>
            <SheetDescription className="px-4" />
            <div className="flex flex-col px-2">
              {onView && (
                <button
                  type="button"
                  onClick={() => { onOpenChange(false); onView(row); }}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-accent"
                >
                  <Eye className="size-4" /> Visualizar
                </button>
              )}
              {onEdit && canEdit(row) && (
                <button
                  type="button"
                  onClick={() => { onOpenChange(false); onEdit(row); }}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-accent"
                >
                  <Pencil className="size-4" /> Editar
                </button>
              )}
              {onDelete && canEdit(row) && (
                <button
                  type="button"
                  onClick={() => { onOpenChange(false); onDelete(row); }}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-destructive hover:bg-accent"
                >
                  <Trash2 className="size-4" /> Excluir
                </button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Adicionar `mobileCorners` ao CrudConfig**

Em `CrudPage.tsx`, alterar a interface `CrudConfig`:

```ts
import type { Column, MobileCorners } from "./types";
```

e adicionar campo:

```ts
  mobileCorners?: MobileCorners<T>;
```

- [ ] **Step 3: Adicionar estado de opções e usar CardList quando mobile**

No componente, adicionar estado e hook:

```ts
import { useIsMobile } from "@/lib/use-is-mobile";
import { CardList } from "./CardList";
import { CardOptionsSheet } from "./CardOptionsSheet";

  const isMobile = useIsMobile();
  const [optionsRow, setOptionsRow] = useState<T | null>(null);
```

Substituir o bloco da tabela (o `<div className="min-h-0 flex-1 overflow-auto rounded-md border">`) por:

```tsx
      <div className={cn("min-h-0 flex-1", isMobile ? "overflow-y-auto" : "overflow-auto rounded-md border")}>
        {isMobile && config.mobileCorners ? (
          <CardList
            corners={config.mobileCorners}
            rows={pageRows}
            loading={loading}
            onTap={(row) => config.onView?.(row)}
            onLongPress={(row) => setOptionsRow(row)}
          />
        ) : (
          <DataTable
            columns={config.columns}
            rows={pageRows}
            selected={selected}
            onToggle={toggle}
            onRowDoubleClick={config.onRowDoubleClick}
            loading={loading}
          />
        )}
      </div>
```

Adicionar o `CardOptionsSheet` ao final, junto do ConfirmDialog:

```tsx
      <CardOptionsSheet
        open={!!optionsRow}
        onOpenChange={(o) => { if (!o) setOptionsRow(null); }}
        row={optionsRow}
        title={(row) => String(config.columns[0].render(row))}
        canEdit={(row) => !(config.protected?.(row))}
        onView={config.onView}
        onEdit={(row) => setDialog({ mode: "edit", row, input: config.toInput(row) })}
        onDelete={(row) => {
          const ids = [row.id];
          setConfirm({
            ids,
            message: ids.length === 1 ? "Excluir este registro?" : `Excluir ${ids.length} registros?`,
          });
        }}
      />
```

- [ ] **Step 4: Esconder toolbar de seleção no mobile**

Envolver os botões Editar/Visualizar/Excluir com `!isMobile &&`:

```tsx
        {!isMobile && (
          <>
            <Button
              variant="outline"
              disabled={selected.size !== 1 || (config.protected?.(rows.find((r) => r.id === [...selected][0])!) ?? false)}
              onClick={() => {
                const row = rows.find((r) => r.id === [...selected][0])!;
                setDialog({ mode: "edit", row, input: config.toInput(row) });
              }}
            >
              <Pencil data-icon="inline-start" />
              Editar
            </Button>
            {config.onView && (
              <Button
                variant="outline"
                disabled={selected.size !== 1}
                onClick={() => config.onView!(rows.find((r) => r.id === [...selected][0])!)}
              >
                <Eye data-icon="inline-start" />
                Visualizar
              </Button>
            )}
            <Button variant="destructive" disabled={selected.size === 0} onClick={askDelete}>
              <Trash2 data-icon="inline-start" />
              Excluir
            </Button>
          </>
        )}
```

- [ ] **Step 5: Typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add components/crud/CrudPage.tsx components/crud/CardOptionsSheet.tsx
git commit -m "feat: CrudPage renderiza cards no mobile com menu de opcoes"
```

---

### Task 8: FormDialog vira bottom sheet no mobile

**Files:**
- Modify: `components/crud/FormDialog.tsx`

- [ ] **Step 1: Usar Sheet bottom no mobile, Dialog no desktop**

Adicionar imports e trocar o retorno:

```tsx
import { useIsMobile } from "@/lib/use-is-mobile";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

  const isMobile = useIsMobile();
```

Trocar o bloco `return` para renderizar condicionalmente. Conteúdo idêntico nos dois (header, spinner/form, footer):

```tsx
  const header = (
    <DialogHeader>
      <DialogTitle>{dialog.mode === "create" ? "Novo" : "Editar"}</DialogTitle>
    </DialogHeader>
  );
  const footer = (
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>Cancelar</Button>
      <Button onClick={() => void submit()} disabled={saving}>
        {saving ? "Salvando..." : "Salvar"}
      </Button>
    </DialogFooter>
  );

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent side="bottom" showCloseButton className="max-h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{dialog.mode === "create" ? "Novo" : "Editar"}</SheetTitle>
          </SheetHeader>
          {resources === null ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : (
            <config.FormFields
              value={value}
              onChange={setValue}
              resources={resources}
              error={error}
            />
          )}
          <SheetFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {header}
        {resources === null ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : (
          <config.FormFields
            value={value}
            onChange={setValue}
            resources={resources}
            error={error}
          />
        )}
        {footer}
      </DialogContent>
    </Dialog>
  );
```

- [ ] **Step 2: Typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/crud/FormDialog.tsx
git commit -m "feat: FormDialog como bottom sheet no mobile"
```

---

### Task 9: ConfirmDialog e dialogs de detalhe como bottom sheet

**Files:**
- Modify: `components/confirm.tsx`
- Modify: `components/transactions/FaturaDetailDialog.tsx`
- Modify: `components/loans/DetailDialog.tsx`
- Modify: `components/UpdateDialog.tsx`

- [ ] **Step 1: ConfirmDialog condicional**

```tsx
"use client";
import { useIsMobile } from "@/lib/use-is-mobile";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open, message, onOpenChange, onConfirm,
}: { open: boolean; message: string; onOpenChange: (o: boolean) => void; onConfirm: () => void }) {
  const isMobile = useIsMobile();

  const body = (
    <>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button variant="destructive" className="flex-1" onClick={() => { onConfirm(); onOpenChange(false); }}>
          Excluir
        </Button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-3 pb-6">
          <SheetHeader>
            <SheetTitle>Confirmar exclusão</SheetTitle>
            <SheetDescription>{message}</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>
              Excluir
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar exclusão</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: FaturaDetailDialog como bottom sheet no mobile**

Substituir o wrapper do Dialog por condicional (idêntico ao padrão acima). Corpo do `DialogContent` é extraído em variável e renderizado dentro de `SheetContent side="bottom"` (com `max-h-[90dvh] overflow-y-auto`) ou `DialogContent` (com `max-h-[90vh] overflow-y-auto sm:max-w-2xl`). Adicionar `const isMobile = useIsMobile();` e imports de Sheet/useIsMobile.

- [ ] **Step 3: DetailDialog (loans) como bottom sheet no mobile**

Mesmo padrão da Step 2. Corpo extraído em variável.

- [ ] **Step 4: UpdateDialog como bottom sheet no mobile**

Mesmo padrão. Corpo extraído em variável (title, description, footer com "Agora não" e "Atualizar e reiniciar").

- [ ] **Step 5: Typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add components/confirm.tsx components/transactions/FaturaDetailDialog.tsx components/loans/DetailDialog.tsx components/UpdateDialog.tsx
git commit -m "feat: dialogs e confirmacao como bottom sheet no mobile"
```

---

### Task 10: mobileCorners por página

**Files:**
- Modify: `app/transactions/page.tsx`
- Modify: `app/installments/page.tsx`
- Modify: `app/fixed-bills/page.tsx`
- Modify: `app/loans/page.tsx`
- Modify: `app/categories/page.tsx`
- Modify: `app/payment-methods/page.tsx`

- [ ] **Step 1: Transações**

Adicionar ao config, após `columns`:

```tsx
          mobileCorners: {
            topLeft: (r) => r.description,
            bottomLeft: (r) => r.category_name ?? "—",
            topRight: (r) => (
              <span className={cn(r.type === 1 ? "text-positive" : "text-negative", "font-mono")}>
                {r.type === 1 ? "+" : "−"} {formatMoney(r.amount)}
              </span>
            ),
            bottomRight: (r) => formatDate(r.date),
          },
```

- [ ] **Step 2: Parcelamentos**

```tsx
          mobileCorners: {
            topLeft: (r) => r.description,
            bottomLeft: (r) => r.category_name ? `${r.category_name} · dia ${r.day}` : `dia ${r.day}`,
            topRight: (r) => (
              <span className="font-mono">{formatMoney(r.amount)}</span>
            ),
            bottomRight: (r) => `${formatMonth(r.start_month)} → ${r.end_month ? formatMonth(r.end_month) : "—"}`,
          },
```

- [ ] **Step 3: Contas Fixas**

```tsx
          mobileCorners: {
            topLeft: (r) => r.description,
            bottomLeft: (r) => r.category_name ? `${r.category_name} · dia ${r.day}` : `dia ${r.day}`,
            topRight: (r) => (
              <span className="font-mono">{formatMoney(r.amount)}</span>
            ),
            bottomRight: (r) => `${formatMonth(r.start_month)} → ${r.end_month ? formatMonth(r.end_month) : "—"}`,
          },
```

- [ ] **Step 4: Financiamentos**

```tsx
          mobileCorners: {
            topLeft: (r) => r.description,
            bottomLeft: (r) => `${r.type === 1 ? "Empréstimo" : "Financiamento"} · ${r.paid_count}/${r.total_installments}`,
            topRight: (r) => (
              <span className="font-mono">{formatMoney(r.installment)}</span>
            ),
            bottomRight: (r) => `${formatMonth(r.start_month)} → ${formatMonth(r.end_month)}`,
          },
```

- [ ] **Step 5: Categorias**

```tsx
          mobileCorners: {
            topLeft: (r) => (
              <span className="flex items-center gap-2">
                <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border" style={{ backgroundColor: r.color }} />
                {r.name}
              </span>
            ),
            topRight: (r) => (r.type === 1 ? "Receita" : "Despesa"),
          },
```

- [ ] **Step 6: Formas de Pagamento**

```tsx
          mobileCorners: {
            topLeft: (r) => r.name,
            bottomLeft: (r) => (r.type === 2 ? "Cartão" : "Padrão"),
            bottomRight: (r) => {
              if (r.type !== 2) return "—";
              try {
                const m = r.metadata ? JSON.parse(r.metadata) : null;
                return m?.close_day ? `${m.close_day}/${m.validity_day ?? "?"}` : "—";
              } catch { return "—"; }
            },
          },
```

- [ ] **Step 7: Typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add app/transactions/page.tsx app/installments/page.tsx app/fixed-bills/page.tsx app/loans/page.tsx app/categories/page.tsx app/payment-methods/page.tsx
git commit -m "feat: mapeamento dos cards mobile por pagina"
```

---

### Task 11: Dashboard mobile padding

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Ajustar título e grid**

O dashboard já usa `sm:grid-cols-2 lg:grid-cols-4`. Manter. Ajustar apenas o `h1` pra não conflitar com o MobileHeader (mobile tem título próprio no header — reduzir no mobile):

```tsx
        <h1 className="text-2xl font-semibold tracking-tight sm:hidden">Dashboard</h1>
```

- [ ] **Step 2: Typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "style: dashboard evita titulo duplicado no mobile"
```

---

### Task 12: Verificação final no Android

**Files:**
- Nenhum (build)

- [ ] **Step 1: Rodar build completo**

Run: `bun run build`
Expected: `out/` gerado sem erro.

- [ ] **Step 2: Build APK armv7 (celular do usuário é 32-bit)**

```bash
export ANDROID_HOME=~/Android/Sdk NDK_HOME=~/Android/Sdk/ndk/25.2.9519653 JAVA_HOME=~/jdk17
bun tauri android build --apk --target armv7
```

Expected: APK gerado em `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`.

- [ ] **Step 3: Assinar e instalar no celular**

```bash
export PATH=~/jdk17/bin:$PATH
~/Android/Sdk/build-tools/34.0.0/apksigner sign \
  --ks ~/Android/debug.keystore --ks-key-alias androiddebugkey \
  --ks-pass pass:android --key-pass pass:android \
  --out src-tauri/gen/android/app/build/outputs/apk/universal/release/ajudafinancas-mobile.apk \
  src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk
export PATH=~/Android/Sdk/platform-tools:$PATH
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/release/ajudafinancas-mobile.apk
```

Expected: `Success`.

- [ ] **Step 4: Teste manual no celular**

Validar em cada página:
1. Bottom bar glass com 4 ícones; "Mais" abre sheet com 4 links.
2. Header com título, pill do mês (abre seleção) e toggle de tema.
3. Cards 4 cantos com dados corretos (Transações com cores de sinal).
4. Toque simples abre visualizar; toque longo abre menu Visualizar/Editar/Excluir.
5. Novo/Editar abre bottom sheet; excluir pede confirmação em bottom sheet.
6. Fatura e financiamento: toque abre detalhe em bottom sheet.
7. Dashboard 1 coluna sem título duplicado.
