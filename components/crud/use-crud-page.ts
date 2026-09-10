"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { msg } from "@/src/shared/repository";
import type { Sort } from "@/src/shared/models";
import type { ActiveFilter, CrudConfig, DialogState } from "./types";
import { matchFilter } from "./match-filter";
import { useFilterParams } from "./use-filter-params";

export function useCrudPage<T extends { id: number }, F, E>(
  config: CrudConfig<T, F, E>,
  autoCreate?: boolean,
) {
  const client = useQueryClient();
  const [dialog, setDialog] = useState<DialogState<T, F> | null>(autoCreate ? { mode: "create" } : null);
  const [confirm, setConfirm] = useState<{ message: string; ids: number[] } | null>(null);
  const [query, setQuery] = useState("");
  const [optionsRow, setOptionsRow] = useState<T | null>(null);
  const [menu, setMenu] = useState<{ row: T; x: number; y: number } | null>(null);

  const filterDefs = useMemo(() => config.filters ?? [], [config.filters]);
  const { filters, setFilter, clearFilters: clearUrlFilters, hasActiveFilters } =
    useFilterParams(filterDefs.map((f) => f.id));
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const toggleAdded = useCallback((id: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSetFilter = useCallback(
    (id: string, filter: ActiveFilter | null) => {
      setPendingIds((prev) => {
        if (prev.has(id)) {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }
        return prev;
      });
      setFilter(id, filter);
    },
    [setFilter],
  );

  const pageSize = config.pageSize ?? 25;
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [sort, setSort] = useState<Sort | null>(null);
  const effectiveKey = useMemo(() => [...config.queryKey, sort], [config.queryKey, sort]);

  const rowsQuery = useQuery({
    queryKey: effectiveKey,
    queryFn: () => config.load(sort),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
  const rows = useMemo(() => rowsQuery.data ?? [], [rowsQuery.data]);
  const loading = rowsQuery.isFetching;

  const derivedOptionsMap = useMemo(() => {
    const map: Record<string, { label: string; value: string | number }[]> = {};
    for (const def of filterDefs) {
      if (!def.options && def.accessor) {
        const seen = new Map<string | number, string>();
        for (const row of rows) {
          const val = def.accessor(row);
          if (val != null && val !== "" && !seen.has(val)) {
            seen.set(val, String(val));
          }
        }
        map[def.id] = Array.from(seen.entries()).map(([value, label]) => ({ label, value }));
      }
    }
    return map;
  }, [filterDefs, rows]);

  const invalidate = useCallback(() => {
    void client.invalidateQueries({ queryKey: effectiveKey, exact: true });
    for (const k of config.invalidate ?? []) {
      void client.invalidateQueries({ queryKey: [...k] });
    }
  }, [client, effectiveKey, config.invalidate]);

  const refresh = useCallback(async () => {
    const res = await rowsQuery.refetch();
    if (res.error) toast.add({ title: msg(res.error), type: "error" });
  }, [rowsQuery]);

  const clearFilters = useCallback(() => {
    setQuery("");
    setSort(null);
    setVisibleCount(pageSize);
    setPendingIds(new Set());
    clearUrlFilters();
  }, [pageSize, clearUrlFilters]);

  const q = query.trim().toLowerCase();
  let filtered = rows;
  for (const def of filterDefs) {
    const active = filters[def.id];
    if (!active) continue;
    filtered = filtered.filter((r) => matchFilter(r, def, active));
  }
  if (q) {
    filtered = filtered.filter((r) =>
      config.columns.some((c) => String(c.render(r)).toLowerCase().includes(q))
    );
  }
  const hasMore = visibleCount < filtered.length;
  const pageRows = filtered.slice(0, visibleCount);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const setSentinel = useCallback((el: HTMLDivElement | null) => {
    sentinelRef.current = el;
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount((c) => c + pageSize);
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, pageSize]);

  const handleSort = (next: Sort | null) => {
    setSort(next);
    setVisibleCount(pageSize);
  };

  const handleRowContextMenu = (row: T, e: MouseEvent) => {
    const canEdit = !config.protected?.(row);
    if (config.onView || canEdit) setMenu({ row, x: e.clientX, y: e.clientY });
  };

  const removeMutation = useMutation({
    mutationFn: (ids: number[]) => config.remove(ids),
    onSuccess: () => {
      setConfirm(null);
      toast.add({ title: "Excluído com sucesso", type: "success" });
      invalidate();
    },
    onError: (e) => toast.add({ title: msg(e), type: "error" }),
  });

  const dataError = rowsQuery.isError && !rowsQuery.data;

  return {
    dialog,
    setDialog,
    confirm,
    setConfirm,
    query,
    setQuery,
    optionsRow,
    setOptionsRow,
    menu,
    setMenu,
    filterDefs,
    filters,
    hasActiveFilters,
    pendingIds,
    toggleAdded,
    handleSetFilter,
    pageSize,
    visibleCount,
    setVisibleCount,
    sort,
    handleSort,
    derivedOptionsMap,
    rows,
    loading,
    filtered,
    pageRows,
    hasMore,
    setSentinel,
    invalidate,
    refresh,
    clearFilters,
    handleRowContextMenu,
    removeMutation,
    dataError,
    dataRefetch: rowsQuery.refetch,
  };
}