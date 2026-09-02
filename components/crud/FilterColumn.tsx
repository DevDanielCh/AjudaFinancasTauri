"use client";
import { useCallback, useState } from "react";
import { ListFilter } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ActiveFilter, FilterDef } from "./types";
import { FilterPopoverBody } from "./FilterPopoverBody";

interface FilterColumnProps<T> {
  def: FilterDef<T>;
  active: ActiveFilter | undefined;
  onApply: (filter: ActiveFilter | null) => void;
  derivedOptions?: { label: string; value: string | number }[];
}

export function FilterColumn<T>({ def, active, onApply, derivedOptions }: FilterColumnProps<T>) {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback((v: boolean) => {
    setOpen(v);
  }, []);

  const isMultiSelect = active?.op === "in" || active?.op === "not_in";

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Filtrar por ${def.label}`}
            className={cn(
              "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span className="relative">
              <ListFilter className="size-3.5" />
              {active && isMultiSelect && active.values.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {active.values.length}
                </span>
              )}
            </span>
          </button>
        }
      />
      <PopoverContent className="w-72 p-0" align="start">
        <FilterPopoverBody
          def={def}
          active={active}
          onApply={onApply}
          onClose={() => setOpen(false)}
          derivedOptions={derivedOptions}
        />
      </PopoverContent>
    </Popover>
  );
}