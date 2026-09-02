"use client";
import { FilterChip } from "./FilterChip";
import type { ActiveFilter, FilterDef } from "./types";

interface FilterBarProps<T> {
  filters: FilterDef<T>[];
  activeFilters: Record<string, ActiveFilter>;
  /** IDs de filtros adicionados à barra mas ainda não preenchidos. */
  pendingIds: Set<string>;
  onSetFilter: (id: string, filter: ActiveFilter | null) => void;
  derivedOptions?: Record<string, { label: string; value: string | number }[]>;
}

export function FilterBar<T extends { id: number }>({
  filters: filterDefs,
  activeFilters,
  pendingIds,
  onSetFilter,
  derivedOptions,
}: FilterBarProps<T>) {
  if (filterDefs.length === 0) return null;

  const addedDefs = filterDefs.filter(
    (def) => activeFilters[def.id] || pendingIds.has(def.id),
  );

  if (addedDefs.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {addedDefs.map((def) => (
        <FilterChip
          key={def.id}
          def={def}
          active={activeFilters[def.id]}
          onApply={(f) => onSetFilter(def.id, f)}
          derivedOptions={derivedOptions?.[def.id]}
        />
      ))}
    </div>
  );
}
