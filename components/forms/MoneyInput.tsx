"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";

const toCents = (digits: string): number => (digits === "" ? 0 : parseInt(digits, 10));

const formatBRL = (cents: number): string => {
  const int = Math.floor(cents / 100);
  const dec = String(cents % 100).padStart(2, "0");
  const grouped = int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${grouped},${dec}`;
};

export function MoneyInput({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (cents: number) => void;
  className?: string;
}) {
  const [digits, setDigits] = useState(() => (value === 0 ? "" : String(value)));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (toCents(digits) !== value) setDigits(value === 0 ? "" : String(value));
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      value={digits === "" ? "" : formatBRL(toCents(digits))}
      onChange={(e) => {
        const clean = e.target.value.replace(/[^\d]/g, "");
        setDigits(clean);
        onChange(toCents(clean));
      }}
      onBlur={() => setDigits(toCents(digits) === 0 ? "" : String(toCents(digits)))}
      onFocus={(e) => e.currentTarget.select()}
    />
  );
}
