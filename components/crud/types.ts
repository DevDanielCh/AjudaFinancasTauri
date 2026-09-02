import type { ReactNode } from "react";

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
