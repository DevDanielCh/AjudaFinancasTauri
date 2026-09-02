"use client";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ActiveFilter } from "./types";

export function useFilterParams(filterIds: string[]) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(() => {
    const result: Record<string, ActiveFilter> = {};
    for (const id of filterIds) {
      const raw = searchParams.get(id);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as ActiveFilter;
        if (parsed && typeof parsed.op === "string" && Array.isArray(parsed.values)) {
          result[id] = parsed;
        }
      } catch {
        // invalid JSON, skip
      }
    }
    return result;
  }, [searchParams, filterIds]);

  const setFilter = useCallback(
    (id: string, filter: ActiveFilter | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (filter) {
        next.set(id, JSON.stringify(filter));
      } else {
        next.delete(id);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clearFilters = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    for (const id of filterIds) {
      next.delete(id);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, filterIds]);

  const hasActiveFilters = Object.keys(filters).length > 0;

  return { filters, setFilter, clearFilters, hasActiveFilters };
}
