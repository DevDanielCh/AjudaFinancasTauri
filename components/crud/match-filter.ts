import type { ActiveFilter, FilterDef } from "./types";

export function matchFilter<T>(row: T, def: FilterDef<T>, active: ActiveFilter): boolean {
  const cellVal = def.accessor?.(row);

  if (active.op === "filled") {
    return cellVal != null && cellVal !== "";
  }

  if (def.field === "select") {
    const raw = cellVal ?? "";
    switch (active.op) {
      case "eq":
        return raw === active.values[0];
      case "neq":
        return raw !== active.values[0];
      case "in":
        return active.values.includes(raw);
      case "not_in":
        return !active.values.includes(raw);
      default:
        return true;
    }
  }

  if (def.field === "text") {
    const s = String(cellVal ?? "").toLowerCase();
    const v = String(active.values[0] ?? "").toLowerCase();
    switch (active.op) {
      case "eq":            return s === v;
      case "neq":           return s !== v;
      case "contains":      return s.includes(v);
      case "not_contains":  return !s.includes(v);
      case "starts_with":   return s.startsWith(v);
      case "ends_with":     return s.endsWith(v);
      default:              return true;
    }
  }

  if (def.field === "number" || def.field === "money") {
    const n = Number(cellVal ?? 0);
    const v = Number(active.values[0] ?? 0);
    switch (active.op) {
      case "eq":      return n === v;
      case "neq":     return n !== v;
      case "gt":      return n > v;
      case "gte":     return n >= v;
      case "lt":      return n < v;
      case "lte":     return n <= v;
      case "between": {
        const lo = Number(active.values[0] ?? 0);
        const hi = Number(active.values[1] ?? 0);
        return n >= lo && n <= hi;
      }
      default:        return true;
    }
  }

  if (def.field === "date") {
    const d = String(cellVal ?? "");
    const v = String(active.values[0] ?? "");
    switch (active.op) {
      case "eq":      return d === v;
      case "neq":     return d !== v;
      case "gt":      return d > v;
      case "gte":     return d >= v;
      case "lt":      return d < v;
      case "lte":     return d <= v;
      case "between": {
        const lo = String(active.values[0] ?? "");
        const hi = String(active.values[1] ?? "");
        return d >= lo && d <= hi;
      }
      default:        return true;
    }
  }

  return true;
}
