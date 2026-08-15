# Right-click com menu de ações em rows — Design

**Data:** 2026-08-15
**Status:** Aprovado

## Objetivo

Ao clicar com o botão direito em uma row de qualquer tabela (DataTable desktop), abrir um dropdown no cursor com ações daquela linha: **Visualizar**, **Editar**, **Excluir** (as que a página define).

## Escopo

- Desktop apenas (`DataTable`). Mobile já tem long-press → `CardOptionsSheet`, fica intacto.
- Todas as 6 telas via `CrudPage` (nenhuma página muda, só o componente genérico).
- Sem botão ⋯ por row (decisão do usuário).
- Right-click seleciona a row em seleção única (decisão do usuário).

## Decisões

1. **Right-click seleciona a row**: se a row não está selecionada, vira `{id}` (seleção única). Se já está, mantém.
2. **Só right-click**: sem coluna de menu ⋯.
3. **Abordagem A**: menu ancorado no cursor reusando `DropdownMenu` (Base UI), estado no `CrudPage`.
4. **Itens do menu espelham `CardOptionsSheet`**: Visualizar (só se `onView`), Editar/Excluir (só se `canEdit(row)` = `!protected(row)`).

## Componentes e props

### `DataTable.tsx`

Nova prop `onRowContextMenu?: (row: T, e: React.MouseEvent) => void`.

No `<TableRow>` (components/crud/DataTable.tsx:142-160), adicionar:

```tsx
onContextMenu={(e) => {
  if (!onRowContextMenu) return;
  e.preventDefault();
  onRowContextMenu(row.original, e);
}}
```

`preventDefault` só quando o callback existe → tabelas que não usam mantêm o menu nativo do browser. DataTable continua sem estado interno.

### `components/crud/RowActionsMenu.tsx` (novo)

Reusa `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem` de `@/components/ui/dropdown-menu` (Base UI).

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

- **Ancora no cursor**: trigger = `<div>` 0×0 com `className="pointer-events-none fixed"` e `style={{ left: x, top: y }}`, renderizado dentro de `<DropdownMenu open={open} onOpenChange={onOpenChange}>`.
- **Conteúdo**: `<DropdownMenuContent side="bottom" align="start" sideOffset={0}>` com itens (mesmo layout de `CardOptionsSheet.tsx:25-51`):
  - `Visualizar` (Eye) — só se `onView`.
  - `Editar` (Pencil) — só se `onEdit` && `canEdit(row)`.
  - `Excluir` (Trash2, `variant="destructive"`) — só se `onDelete` && `canEdit(row)`.
- Cada item: `onClick` → `onOpenChange(false)` + executa a ação.
- **Fechar**: ação, clique fora (Base UI), Esc (Base UI), `scroll`/`resize` (listener manual, ver Edge cases).
- **Sem ações válidas** (row protegida e sem `onView`): CrudPage não abre o menu.

### `CrudPage.tsx`

- Estado novo: `const [menu, setMenu] = useState<{ row: T; x: number; y: number } | null>(null);`
- Handler:

```tsx
const handleRowContextMenu = (row: T, e: React.MouseEvent) => {
  if (!selected.has(row.id)) setSelected(new Set([row.id]));
  const canEdit = !config.protected?.(row);
  const hasActions = config.onView || canEdit;
  if (hasActions) setMenu({ row, x: e.clientX, y: e.clientY });
};
```

- `<DataTable>` ganha `onRowContextMenu={handleRowContextMenu}`.
- Renderiza `<RowActionsMenu>` junto ao `<CardOptionsSheet>` (depois da linha ~303):

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

Mesmos callbacks do `CardOptionsSheet` (linhas 288-303).

## Fluxo de dados

1. Right-click na row → `onContextMenu` no `<tr>` → `preventDefault` (suprime menu nativo) → `handleRowContextMenu`.
2. CrudPage seleciona a row (seleção única) e abre `RowActionsMenu` em `(clientX, clientY)`.
3. Ação → menu fecha + executa:
   - Visualizar → `config.onView(row)`
   - Editar → `setDialog({ mode: "edit", row, input: config.toInput(row) })`
   - Excluir → `setConfirm({ ids: [row.id], ... })` (fluxo de confirmação existente + `removeMutation`)

## Edge cases

- **Scroll/redimensionar fecha o menu**: a área de rows é scrollável; `RowActionsMenu` adiciona listener `scroll` (capture) e `resize` no window que chamam `onOpenChange(false)`. Remove no unmount/efeito.
- **Menu vazio não abre**: `hasActions` no CrudPage; row protegida (ex.: faturas) sem `onView` → nada.
- **Faturas protegidas**: Editar/Excluir ocultos (igual sheet). Se a página tiver `onView`, mostra Visualizar.
- **Header / área vazia**: handler só na row `<tr>` → sem menu.
- **Tabelas sem `onView`** (ex.: transactions): menu com Editar/Excluir apenas.
- **Mobile**: `DataTable` não renderizado no mobile; long-press intacto. Sem conflito com a lição do AGENTS.md (timer de long-press é do `CardList`/`CardOptionsSheet`).
- **Duplo-clique** (`onRowDoubleClick`) continua independente.

## Testes

- Sem mudança de backend → sem testes Rust.
- Frontend sem test framework no repo → verificação manual (check-list no plano):
  - Right-click abre menu no cursor em cada uma das 6 telas.
  - Visualizar/Editar/Excluir executam e fecham o menu.
  - Seleção única ao right-click (checkbox + toolbar refletem).
  - Fecha em Esc, clique fora e scroll.
  - Faturas: sem Editar/Excluir no menu.
  - Mobile: long-press continua funcionando.
