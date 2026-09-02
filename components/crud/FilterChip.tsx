"use client";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { ActiveFilter, FilterDef, FilterField } from "./types";
import { OP_LABELS } from "./types";
import { FilterPopoverBody } from "./FilterPopoverBody";

interface FilterChipProps<T> {
  def: FilterDef<T>;
  active: ActiveFilter | undefined;
  onApply: (filter: ActiveFilter | null) => void;
  derivedOptions?: { label: string; value: string | number }[];
}

export function FilterChip<T>({ def, active, onApply, derivedOptions }: FilterChipProps<T>) {
  const [open, setOpen] = useState(false);

  const resetPending = useCallback(() => {
    setOpen(false);
  }, []);

  const handleOpen = useCallback((v: boolean) => {
    if (!v) resetPending();
    setOpen(v);
  }, [resetPending]);

  const isMultiSelect = active?.op === "in" || active?.op === "not_in";

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5 font-normal",
              active && "border-primary bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            <span>{formatChipLabel(def, active)}</span>
            {active && isMultiSelect && active.values.length > 0 && (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px] font-bold">
                {active.values.length}
              </span>
            )}
          </Button>
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

export function formatChipLabel<T>(def: FilterDef<T>, active: ActiveFilter | undefined): string {
  if (!active) return def.label;

  if (active.op === "filled") {
    return `${def.label}: preenchido`;
  }

  if (def.field === "select" && (active.op === "in" || active.op === "not_in")) {
    const opts = def.options ?? [];
    const labels = active.values
      .map((v) => opts.find((o) => o.value === v)?.label ?? String(v));
    const joined = labels.join(", ") || "…";
    const prefix = active.op === "not_in" ? "não é um de: " : "";
    return `${def.label}: ${prefix}${joined}`;
  }

  const opLabel = active.op === "eq" ? "" : `${OP_LABELS[active.op]} `;

  if (active.op === "between") {
    const v0 = formatValue(def.field, active.values[0]);
    const v1 = formatValue(def.field, active.values[1]);
    return `${def.label}: ${v0} – ${v1}`;
  }

  const val = formatValue(def.field, active.values[0]);
  return `${def.label}: ${opLabel}${val}`;
}

function formatValue(field: FilterField, val: string | number): string {
  if (field === "date" && typeof val === "string" && val) {
    const [y, m, d] = val.split("-");
    return `${d}/${m}/${y}`;
  }
  if (field === "money" && typeof val === "number") {
    return formatMoney(val);
  }
  return String(val);
}