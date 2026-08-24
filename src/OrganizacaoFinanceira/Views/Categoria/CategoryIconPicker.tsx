"use client";
import { createElement, useMemo, useState } from "react";
import { ChevronDown, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CATEGORY_ICONS, getCategoryIcon } from "./icons";

export function CategoryIconPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "-");
    if (!q) return Object.keys(CATEGORY_ICONS);
    return Object.keys(CATEGORY_ICONS).filter((name) => name.includes(q));
  }, [query]);

  const Icon = getCategoryIcon(value);

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between font-normal"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2">
          {Icon ? (
            <>
              {createElement(Icon, { className: "size-4" })}
              <span>{value}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Sem ícone</span>
          )}
        </span>
        <ChevronDown data-icon="inline-end" className="opacity-50" />
      </Button>
      {open && (
        <div className="mt-2 rounded-md border border-input p-2">
          <Input
            placeholder="Buscar ícone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-2 grid max-h-44 grid-cols-6 gap-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => onChange(null)}
              title="Sem ícone"
              className={cn(
                "flex h-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted",
                !value && "bg-accent text-accent-foreground"
              )}
            >
              <CircleX className="size-4" />
            </button>
            {filtered.map((name) => {
              const Item = CATEGORY_ICONS[name];
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => onChange(name)}
                  className={cn(
                    "flex h-9 cursor-pointer items-center justify-center rounded-md hover:bg-muted",
                    value === name && "bg-accent text-accent-foreground"
                  )}
                >
                  <Item className="size-4" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
