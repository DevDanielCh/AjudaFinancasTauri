"use client";

import { FieldError } from "@/components/ui/field";

export function FieldErrors({ errors }: { errors: unknown[] }) {
  const items = errors
    .map((e) =>
      typeof e === "string" ? { message: e } : (e as { message?: string } | undefined)
    )
    .filter((e): e is { message?: string } => typeof e?.message === "string");

  if (items.length === 0) return null;

  return <FieldError errors={items} />;
}
