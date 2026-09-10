import type { ReactNode } from "react";
import type { ZodType } from "zod";
import type { CrudFormApi } from "@/lib/forms";
import type { Sort } from "@/src/shared/models";

export interface Column<T> {
  label: string;
  name?: string;
  /** Liga a coluna a um FilterDef com o mesmo id (habilita ícone de filtro no header). */
  filterId?: string;
  render: (row: T) => ReactNode;
  className?: string;
  sortValue?: (row: T) => string | number;
}

export interface MobileCorners<T> {
  topLeft: (row: T) => ReactNode;
  bottomLeft?: (row: T) => ReactNode;
  topRight?: (row: T) => ReactNode;
  bottomRight?: (row: T) => ReactNode;
}

// ── Filter system ──

export type FilterField = "text" | "number" | "money" | "date" | "select";

export type FilterOp =
  | "eq" | "neq" | "filled"
  | "contains" | "not_contains" | "starts_with" | "ends_with"
  | "gt" | "gte" | "lt" | "lte" | "between"
  | "in" | "not_in";

export const OPS_BY_FIELD: Record<FilterField, FilterOp[]> = {
  text:   ["eq", "neq", "filled", "contains", "not_contains", "starts_with", "ends_with"],
  number: ["eq", "neq", "filled", "gt", "gte", "lt", "lte", "between"],
  money:  ["eq", "neq", "filled", "gt", "gte", "lt", "lte", "between"],
  date:   ["eq", "neq", "filled", "gt", "gte", "lt", "lte", "between"],
  select: ["eq", "neq", "filled", "in", "not_in"],
};

export const OP_LABELS: Record<FilterOp, string> = {
  eq:            "Igual",
  neq:           "Diferente",
  filled:        "Preenchido",
  contains:      "Contém",
  not_contains:  "Não contém",
  starts_with:   "Começa com",
  ends_with:     "Termina com",
  gt:            "Maior que",
  gte:           "Maior ou igual",
  lt:            "Menor que",
  lte:           "Menor ou igual",
  between:       "Entre",
  in:            "É um de",
  not_in:        "Não é um de",
};

export const DEFAULT_OP: Record<FilterField, FilterOp> = {
  text:   "contains",
  number: "eq",
  money:  "eq",
  date:   "gte",
  select: "in",
};

export interface FilterOption {
  label: string;
  value: string | number;
}

export interface FilterDef<T> {
  id: string;
  label: string;
  field: FilterField;
  placeholder?: string;
  options?: FilterOption[];
  accessor?: (row: T) => string | number | null;
}

export interface ActiveFilter {
  op: FilterOp;
  values: (string | number)[];
}

// ── CrudPage config ──

export interface CrudConfig<T extends { id: number }, F, E> {
  title: string;
  columns: Column<T>[];
  pageSize?: number;
  /** Rótulo do botão principal de criação (padrão: "Adicionar"). */
  addLabel?: string;
  /** Título do modal de criação (padrão: "Novo {title sem plural}"). */
  newTitle?: string;
  /** Título do modal de edição (padrão: "Editar {title sem plural}"). */
  editTitle?: string;
  keepOpen?: boolean;
  /** Hook chamado após criar/editar com sucesso (além da invalidação padrão). */
  onSaved?: () => void;
  load: (sort: Sort | null) => Promise<T[]>;
  create: (data: F) => Promise<void>;
  update: (id: number, data: F) => Promise<void>;
  remove: (ids: number[]) => Promise<void>;
  empty: () => F;
  toInput: (row: T) => F;
  loadResources?: () => Promise<E>;
  FormFields: React.ComponentType<{
    form: CrudFormApi<F>;
    resources: E | undefined;
    serverError: string | null;
  }>;
  /** Componente de leitura usado no duplo clique da linha (modo "visualizar"). */
  ViewFields?: React.ComponentType<{ row: T }>;
  onRowDoubleClick?: (row: T) => void;
  onView?: (row: T) => void;
  protected?: (row: T) => boolean;
  /** Conteúdo exibido entre o título e a busca (ex.: card de saldo). */
  summary?: (rows: T[]) => ReactNode;
  mobileCorners?: MobileCorners<T>;
  /** Classe extra aplicada a cada linha/card (ex.: opacity para inativo). */
  rowClass?: (row: T) => string;
  /** Classe extra aplicada à área de scroll da tabela (ex.: flex em dialogs). */
  tableClassName?: string;
  /** Chave do react-query para esta página. */
  queryKey: readonly unknown[];
  /** Outras queries a invalidar após criar/editar/excluir. */
  invalidate?: readonly (readonly unknown[])[];
  /** Validação zod dos formulários (Standard Schema). */
  schema: ZodType<F>;
  /** Definições de filtros por campo desta página. */
  filters?: FilterDef<T>[];
}

export type DialogState<T, F> =
  | { mode: "create"; input?: F }
  | { mode: "edit"; row: T; input: F }
  | { mode: "view"; row: T };
