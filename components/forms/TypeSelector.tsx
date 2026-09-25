"use client";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TypeOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  tone?: "primary" | "positive" | "negative";
}

const TONE_CLASSES: Record<NonNullable<TypeOption["tone"]>, string> = {
  primary:
    "border-primary bg-primary/10 text-primary dark:bg-primary/20",
  positive:
    "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  negative:
    "border-red-500 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400",
};

export function TypeSelector({
  options,
  value,
  onChange,
  size = "lg",
  className,
}: {
  options: TypeOption[];
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Tipo"
      className={cn(
        "grid grid-cols-2 gap-2",
        options.length === 3 && "grid-cols-3",
        className
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors",
              size === "lg" ? "h-11" : "h-9",
              selected
                ? TONE_CLASSES[opt.tone ?? "primary"]
                : "border-input bg-transparent text-muted-foreground hover:bg-muted"
            )}
          >
            {Icon && <Icon className="size-4" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}