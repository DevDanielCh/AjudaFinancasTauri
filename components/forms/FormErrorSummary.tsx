"use client";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FormErrorSummary({
  count,
  onReset,
}: {
  count: number;
  onReset: () => void;
}) {
  if (count === 0) return null;
  return (
    <div
      role="alert"
      data-slot="form-error-summary"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive dark:border-destructive/40 dark:bg-destructive/10"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">
        {count === 1
          ? "Há 1 campo com problema. Corrija antes de salvar."
          : `Há ${count} campos com problema. Corrija antes de salvar.`}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Fechar"
        onClick={onReset}
      >
        <X />
      </Button>
    </div>
  );
}