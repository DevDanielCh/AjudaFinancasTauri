"use client";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function StepperInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  size = "lg",
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: "default" | "lg";
  className?: string;
}) {
  const clamp = (v: number) =>
    Math.min(max ?? v, Math.max(min ?? v, v));

  return (
    <div className={cn("flex w-full items-stretch gap-1.5", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Diminuir"
        onClick={() => onChange(clamp(value - step))}
        className={cn(size === "lg" && "h-11 w-11")}
      >
        <Minus />
      </Button>
      <Input
        type="number"
        inputMode="numeric"
        size={size}
        value={value || ""}
        onChange={(e) => onChange(clamp(e.target.value ? Number(e.target.value) : 0))}
        className="text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Aumentar"
        onClick={() => onChange(clamp(value + step))}
        className={cn(size === "lg" && "h-11 w-11")}
      >
        <Plus />
      </Button>
    </div>
  );
}