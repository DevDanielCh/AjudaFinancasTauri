"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";

const toCents = (reais: string): number => {
  if (reais === "") return 0;
  const n = parseFloat(reais.replace(/\.(?=\d{3})/g, "").replace(",", "."));
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
};

/** Formata centavos em string pt-BR, ex.: 12345650 → "123.456,50". */
const formatCents = (cents: number): string => {
  const int = Math.floor(cents / 100);
  const dec = String(cents % 100).padStart(2, "0");
  const grouped = int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${grouped},${dec}`;
};

export function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  /** Valor em centavos. */
  value: number;
  onChange: (cents: number) => void;
  placeholder?: string;
  className?: string;
}) {
  // Rascunho em reais enquanto edita; null = não editando.
  const [draft, setDraft] = useState<string | null>(null);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={draft !== null ? draft : value === 0 ? "" : formatCents(value)}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^\d.,]/g, "");
        setDraft(cleaned);
        onChange(toCents(cleaned));
      }}
      onFocus={(e) => setDraft(e.currentTarget.value)}
      onBlur={() => setDraft(null)}
    />
  );
}