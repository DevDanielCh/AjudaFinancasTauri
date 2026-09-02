"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonthISO, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

export function MonthPicker({
  value, onChange, min, compact,
}: { value: string; onChange: (v: string) => void; min?: string; compact?: boolean }) {
  const [year, setYear] = useState(() => Number((value || currentMonthISO()).slice(0, 4)));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "font-normal",
              compact ? "justify-center gap-2" : "w-full justify-between"
            )}
          >
            <span>{formatMonth(value)}</span>
            {!compact && <ChevronDown data-icon="inline-end" className="opacity-50" />}
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
        <div className="flex items-center justify-between px-2 pt-2">
          <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft />
          </Button>
          <span className="text-sm font-medium">{year}</span>
          <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-1 p-2">
          {MONTHS.map((m, i) => {
            const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
            const disabled = min ? ym < min : false;
            return (
              <button
                key={m}
                disabled={disabled}
                aria-pressed={ym === value}
                onClick={() => onChange(ym)}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40",
                  ym === value && "bg-primary text-primary-foreground"
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
