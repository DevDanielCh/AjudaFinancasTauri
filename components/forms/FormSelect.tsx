"use client";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FormSelectOption {
  value: string;
  label: string;
}

export function FormSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  size = "default",
}: {
  value: string;
  onChange: (v: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  className?: string;
  size?: "default" | "lg";
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(v) => onChange(String(v))}
    >
      <SelectTrigger size={size} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
