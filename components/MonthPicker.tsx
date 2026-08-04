"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

export function MonthPicker({
  value, onChange, min,
}: { value: string; onChange: (v: string) => void; min?: string }) {
  const [year, setYear] = useState(() => Number((value || new Date().toISOString().slice(0,7)).slice(0,4)));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="w-full justify-between font-normal">
            <span>{formatMonth(value)}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
        <div className="flex items-center justify-between px-2 pt-2">
          <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{year}</span>
          <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
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
                onClick={() => onChange(ym)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-40",
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
