"use client";
import { createElement } from "react";
import { getCategoryIcon } from "@/src/OrganizacaoFinanceira/Views/Categoria/icons";
import { cn } from "@/lib/utils";

/** Chip circular com cor + ícone da categoria. Sem cor/ícone cai para neutro. */
export function CategoryChip({
  color,
  icon,
  size = "md",
}: {
  color?: string | null;
  icon?: string | null;
  size?: "sm" | "md";
}) {
  const Icon = getCategoryIcon(icon);
  const sizeClass = size === "sm" ? "size-5" : "size-6";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border",
        sizeClass,
        color ? "border-black/10 text-white" : "bg-muted text-muted-foreground"
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {Icon &&
        createElement(Icon, {
          className: size === "sm" ? "size-3" : "size-3.5",
        })}
    </span>
  );
}