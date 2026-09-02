"use client";
import { Check, ListFilter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActiveFilter, FilterDef } from "./types";

interface FilterMenuProps<T> {
  filters: FilterDef<T>[];
  activeFilters: Record<string, ActiveFilter>;
  /** IDs já adicionados à barra (placeholders + preenchidos). */
  addedIds: Set<string>;
  onAdd: (id: string) => void;
}

export function FilterMenu<T>({
  filters, activeFilters, addedIds, onAdd,
}: FilterMenuProps<T>) {
  const count = Object.keys(activeFilters).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline">
            <ListFilter data-icon="inline-start" />
            Filtros
            {count > 0 && (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                {count}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Filtros</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {filters.map((def) => {
          const added = addedIds.has(def.id);
          const filled = !!activeFilters[def.id];
          return (
            <DropdownMenuItem
              key={def.id}
              className="cursor-pointer"
              onClick={() => onAdd(def.id)}
            >
              <span className="flex-1 truncate">{def.label}</span>
              {added && (
                <span className="inline-flex shrink-0 items-center justify-center">
                  {filled ? <Check className="size-3.5 text-primary" /> : <Plus className="size-3.5 text-muted-foreground" />}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}