# Right-click com menu de ações em rows — Plano de Implementação

> **Para agentic workers:** SUB-SKILL OBRIGATÓRIA: usar superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa por tarefa. Passos usam checkbox (`- [ ]`) de rastreio.

**Goal:** Right-click em row de qualquer tabela desktop abre dropdown no cursor com Visualizar/Editar/Excluir daquela linha, selecionando a row em seleção única.

**Architecture:** DataTable reporta o right-click (`onRowContextMenu` + `preventDefault`); CrudPage é dono do estado do menu e reusa os mesmos handlers do `CardOptionsSheet`; novo componente `RowActionsMenu` ancora um `DropdownMenu` (Base UI) no cursor via trigger de 0×0 renderizado em `position: fixed`. Mobile intocado (CardList + long-press).

**Tech Stack:** React 19, TypeScript, Base UI (`@base-ui/react/menu` v1.7, wrap em `components/ui/dropdown-menu.tsx`), shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-08-15-row-context-menu-design.md`

**Contrato de props do novo componente:**

```tsx
export function RowActionsMenu<T extends { id: number }>({
  open, onOpenChange, row, x, y, canEdit, onView, onEdit, onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: T | null;
  x: number;
  y: number;
  canEdit: (row: T) => boolean;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
})
```

---

### Task 1: DataTable — prop `onRowContextMenu`

**Files:**
- Modify: `components/crud/DataTable.tsx:28-40` (assinatura + props) e `:142-160` (TableRow)

- [ ] **Step 1: Adicionar prop**

Em `components/crud/DataTable.tsx`, adicionar `onRowContextMenu` ao destructuring e ao tipo (linhas 28-40):

```tsx
export function DataTable<T extends { id: number }>({
  columns, rows, selected, onToggle, onRowDoubleClick, loading, rowClass, sort, onSort, onRowContextMenu,
}: {
  columns: Column<T>[];
  rows: T[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onRowDoubleClick?: (row: T) => void;
  onRowContextMenu?: (row: T, e: React.MouseEvent) => void;
  loading?: boolean;
  rowClass?: (row: T) => string;
  sort?: Sort | null;
  onSort: (sort: Sort | null) => void;
}) {
```

`React` já está importado (`import * as React from "react"` na linha 2) — `React.MouseEvent` disponível.

- [ ] **Step 2: Handler no TableRow**

Adicionar `onContextMenu` no `<TableRow>` (linhas 143-148):

```tsx
          <TableRow
            key={row.original.id}
            className={cn("cursor-pointer", rowClass?.(row.original))}
            onClick={() => onToggle(row.original.id)}
            onDoubleClick={() => onRowDoubleClick?.(row.original)}
            onContextMenu={(e) => {
              if (!onRowContextMenu) return;
              e.preventDefault();
              onRowContextMenu(row.original, e);
            }}
          >
```

- [ ] **Step 3: Typecheck**

Run: `bun typecheck`
Expected: zero erros (nenhuma página passa `onRowContextMenu` ainda — prop é opcional).

- [ ] **Step 4: Commit**

```bash
git add components/crud/DataTable.tsx
git commit -m "feat: DataTable reporta right-click via onRowContextMenu"
```

---

### Task 2: Componente `RowActionsMenu`

**Files:**
- Create: `components/crud/RowActionsMenu.tsx`

- [ ] **Step 1: Criar o componente**

Criar `components/crud/RowActionsMenu.tsx`:

```tsx
"use client";
import { useEffect } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RowActionsMenu<T extends { id: number }>({
  open, onOpenChange, row, x, y, canEdit, onView, onEdit, onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: T | null;
  x: number;
  y: number;
  canEdit: (row: T) => boolean;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const close = () => onOpenChange(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, onOpenChange]);

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger
        render={<span style={{ position: "fixed", left: x, top: y }} className="pointer-events-none" />}
      />
      <DropdownMenuContent side="bottom" align="start" sideOffset={0}>
        {row && onView && (
          <DropdownMenuItem onClick={() => { onOpenChange(false); onView(row); }}>
            <Eye />
            Visualizar
          </DropdownMenuItem>
        )}
        {row && onEdit && canEdit(row) && (
          <DropdownMenuItem onClick={() => { onOpenChange(false); onEdit(row); }}>
            <Pencil />
            Editar
          </DropdownMenuItem>
        )}
        {row && onDelete && canEdit(row) && (
          <DropdownMenuItem variant="destructive" onClick={() => { onOpenChange(false); onDelete(row); }}>
            <Trash2 />
            Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

Notas:
- `modal={false}`: sem scroll-lock do documento; clique fora continua fechando (dismiss padrão da Base UI).
- `render={<span ... />}` no trigger: substitui o `<button>` padrão por um span 0×0 fixado no cursor — âncora do Positioner (padrão de context menu da Base UI).
- `w-(--anchor-width)` + `min-w-32` do `DropdownMenuContent` mantêm largura mínima com âncora de 0px.

- [ ] **Step 2: Typecheck**

Run: `bun typecheck`
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add components/crud/RowActionsMenu.tsx
git commit -m "feat: RowActionsMenu ancorado no cursor com Visualizar/Editar/Excluir"
```

---

### Task 3: CrudPage — estado, handler e render

**Files:**
- Modify: `components/crud/CrudPage.tsx:6` (import de ícone/componente), `:67` (estado), `:126-137` (handler), `:252-262` (prop no DataTable), `:288-303` (render junto ao CardOptionsSheet)

- [ ] **Step 1: Imports**

Em `components/crud/CrudPage.tsx`:

```tsx
import { RowActionsMenu } from "./RowActionsMenu";
```

(junto ao `import { CardOptionsSheet } from "./CardOptionsSheet";` da linha 13)

`CrudPage.tsx` não importa o namespace `React` (só `useCallback`/`useEffect`/etc. de `"react"`). O handler usa `React.MouseEvent` — adicionar import type:

```tsx
import type { MouseEvent } from "react";
```

Nota: o `MouseEvent` importado de `"react"` é o tipo de evento sintético do React (sombreia o global do DOM) — é o que o handler do `DataTable` espera.

- [ ] **Step 2: Estado**

Adicionar após a linha `const [optionsRow, setOptionsRow] = useState<T | null>(null);` (linha 67):

```tsx
  const [menu, setMenu] = useState<{ row: T; x: number; y: number } | null>(null);
```

- [ ] **Step 3: Handler**

Adicionar após o `handleSort` (linhas 134-137):

```tsx
  const handleRowContextMenu = (row: T, e: MouseEvent) => {
    if (!selected.has(row.id)) setSelected(new Set([row.id]));
    const canEdit = !config.protected?.(row);
    if (config.onView || canEdit) setMenu({ row, x: e.clientX, y: e.clientY });
  };
```

- [ ] **Step 4: Prop no DataTable**

No `<DataTable>` (linhas 252-262), adicionar após `onSort={handleSort}`:

```tsx
              onRowContextMenu={handleRowContextMenu}
```

- [ ] **Step 5: Render do RowActionsMenu**

Adicionar logo após o `<CardOptionsSheet .../>` (depois da linha 303, antes do fechamento do `<div>`):

```tsx
        <RowActionsMenu
          open={!!menu}
          onOpenChange={(o) => { if (!o) setMenu(null); }}
          row={menu?.row ?? null}
          x={menu?.x ?? 0}
          y={menu?.y ?? 0}
          canEdit={(row) => !(config.protected?.(row))}
          onView={config.onView}
          onEdit={(row) => setDialog({ mode: "edit", row, input: config.toInput(row) })}
          onDelete={(row) => {
            setMenu(null);
            setConfirm({ ids: [row.id], message: "Excluir este registro?" });
          }}
        />
```

- [ ] **Step 6: Typecheck + lint**

Run: `bun typecheck && bun lint`
Expected: zero erros (0 warnings).

- [ ] **Step 7: Commit**

```bash
git add components/crud/CrudPage.tsx
git commit -m "feat: right-click em row abre menu de acoes (visualizar/editar/excluir)"
```

---

### Task 4: Verificação final

**Files:**
- Nenhum (checklist manual)

- [ ] **Step 1: Checks automáticos**

Run: `bun typecheck && bun lint`
Expected: zero erros.

- [ ] **Step 2: Smoke test manual**

Run: `bun tauri dev` e verificar em cada uma das 6 telas (transactions, categories, fixed-bills, installments, loans, payment-methods):

- [ ] Right-click em uma row abre o menu **no cursor** (e não o menu nativo do browser).
- [ ] Row clicada vira seleção única (checkbox marcado, outras desmarcadas, toolbar Editar/Excluir refletem).
- [ ] **Visualizar** abre a view (nas telas que têm `onView`).
- [ ] **Editar** abre o `FormDialog` no modo edit.
- [ ] **Excluir** abre o `ConfirmDialog` e exclui.
- [ ] Menu fecha em: clique fora, Esc e scroll da tabela.
- [ ] Row protegida (fatura): menu sem Editar/Excluir.
- [ ] Tela sem `onView` (ex.: transactions): menu com Editar/Excluir apenas.
- [ ] Mobile: long-press continua abrindo o `CardOptionsSheet` (right-click não existe).
- [ ] Duplo-clique (`onRowDoubleClick`) continua funcionando.

- [ ] **Step 3: Docs sync**

Se nada mudou no design durante a implementação, nenhum commit extra de docs. Se algo divergiu, atualizar `docs/superpowers/specs/2026-08-15-row-context-menu-design.md` e commitar `git commit -m "docs: sync design do right-click"`.

- [ ] **Step 4: Final**

Confirmar `git log --oneline -8` com os 4 commits (DataTable → RowActionsMenu → CrudPage → docs se houver).
