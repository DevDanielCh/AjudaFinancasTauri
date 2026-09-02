"use client";
import { useCallback, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/DatePicker";
import { MoneyInput } from "@/components/ui/money-input";
import { cn } from "@/lib/utils";
import {
  type ActiveFilter, type FilterDef, type FilterField, type FilterOp,
  OPS_BY_FIELD, OP_LABELS, DEFAULT_OP,
} from "./types";

interface FilterPopoverBodyProps<T> {
  def: FilterDef<T>;
  active: ActiveFilter | undefined;
  onApply: (filter: ActiveFilter | null) => void;
  onClose: () => void;
  derivedOptions?: { label: string; value: string | number }[];
}

export function FilterPopoverBody<T>({
  def, active, onApply, onClose, derivedOptions,
}: FilterPopoverBodyProps<T>) {
  const options = def.options ?? derivedOptions ?? [];

  const [pendingOp, setPendingOp] = useState<FilterOp>(active?.op ?? DEFAULT_OP[def.field]);
  const [pendingValues, setPendingValues] = useState<(string | number)[]>(active?.values ?? []);

  const needsValue = pendingOp !== "filled";
  const isBetween = pendingOp === "between";
  const isSelect = def.field === "select";

  const hasEmptyValue = isSelect
    ? pendingValues.length === 0
    : !pendingValues[0] && pendingValues[0] !== 0;

  const canApply = pendingOp === "filled" || !hasEmptyValue;

  const handleApply = useCallback(() => {
    if (!canApply) return;
    if (pendingOp === "filled") {
      onApply({ op: "filled", values: [] });
    } else {
      onApply({ op: pendingOp, values: pendingValues });
    }
    onClose();
  }, [canApply, pendingOp, pendingValues, onApply, onClose]);

  const handleRemove = useCallback(() => {
    onApply(null);
    onClose();
  }, [onApply, onClose]);

  const updateValue = useCallback((idx: number, val: string | number) => {
    setPendingValues((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }, []);

  const toggleMultiSelect = useCallback((val: string | number) => {
    setPendingValues((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  }, []);

  const availableOps = OPS_BY_FIELD[def.field];

  return (
    <div className="flex flex-col gap-2.5 p-2.5">
      <p className="text-xs font-medium text-muted-foreground">{def.label}</p>

      {isSelect && options.length > 0 ? (
        <>
          <Select
            value={pendingOp}
            items={availableOps.map((op) => ({ value: op, label: OP_LABELS[op] }))}
            onValueChange={(v) => {
              setPendingOp(v as FilterOp);
              if (v === "filled") setPendingValues([]);
            }}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="Operador" />
            </SelectTrigger>
            <SelectContent>
              {availableOps.map((op) => (
                <SelectItem key={op} value={op}>{OP_LABELS[op]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {needsValue && (
            <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
              {options.map((opt) => {
                const checked = pendingValues.includes(opt.value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                      checked && "bg-accent",
                    )}
                    onClick={() => toggleMultiSelect(opt.value)}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {checked && <Check className="size-3" />}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <Select
            value={pendingOp}
            items={availableOps.map((op) => ({ value: op, label: OP_LABELS[op] }))}
            onValueChange={(v) => {
              setPendingOp(v as FilterOp);
              if (v === "filled") setPendingValues([]);
              if (v === "between" && pendingValues.length < 2) {
                setPendingValues(["", ""]);
              }
            }}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="Operador" />
            </SelectTrigger>
            <SelectContent>
              {availableOps.map((op) => (
                <SelectItem key={op} value={op}>{OP_LABELS[op]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {needsValue && (
            <div className="flex flex-col gap-1.5">
              {isBetween ? (
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">De</Label>
                    <FilterValueInput
                      field={def.field}
                      value={pendingValues[0] ?? ""}
                      onChange={(v) => updateValue(0, v)}
                      placeholder={def.placeholder}
                    />
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div className="flex flex-1 flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Até</Label>
                    <FilterValueInput
                      field={def.field}
                      value={pendingValues[1] ?? ""}
                      onChange={(v) => updateValue(1, v)}
                      placeholder={def.placeholder}
                    />
                  </div>
                </div>
              ) : (
                <FilterValueInput
                  field={def.field}
                  value={pendingValues[0] ?? ""}
                  onChange={(v) => updateValue(0, v)}
                  placeholder={def.placeholder}
                />
              )}
            </div>
          )}
        </>
      )}

      <Separator />

      <div className="flex gap-2">
        {active && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={handleRemove}>
            Remover
          </Button>
        )}
        <Button size="sm" className="ml-auto" disabled={!canApply} onClick={handleApply}>
          Aplicar
        </Button>
      </div>
    </div>
  );
}

function FilterValueInput({
  field, value, onChange, placeholder,
}: {
  field: FilterField;
  value: string | number;
  onChange: (v: string | number) => void;
  placeholder?: string;
}) {
  if (field === "date") {
    return (
      <DatePicker
        value={typeof value === "string" ? value || null : null}
        onChange={(v) => onChange(v ?? "")}
        placeholder={placeholder ?? "Selecionar data"}
      />
    );
  }

  if (field === "money") {
    return (
      <MoneyInput
        value={typeof value === "number" ? value : Number(value) || 0}
        onChange={(c) => onChange(c)}
        placeholder={placeholder ?? "0,00"}
      />
    );
  }

  if (field === "number") {
    return (
      <Input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder ?? "0,00"}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,-]/g, "").replace(",", ".");
          const num = parseFloat(raw);
          onChange(isNaN(num) ? raw : num);
        }}
      />
    );
  }

  return (
    <Input
      value={String(value)}
      placeholder={placeholder ?? "Digite..."}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}