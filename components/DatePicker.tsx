"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const WEEKDAYS = ["D","S","T","Q","Q","S","S"];

export function DatePicker({
  value, onChange, placeholder = "Selecione a data",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const [y, m] = (value || new Date().toISOString().slice(0, 10)).split("-").map(Number);
    return { y, m: m - 1 };
  });

  const nav = (delta: number) =>
    setView(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const firstDay = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const today = new Date();
  const fmt = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="w-full justify-between font-normal">
            <span className={cn(!value && "text-muted-foreground")}>
              {value ? formatDate(value) : placeholder}
            </span>
            <ChevronDown data-icon="inline-end" className="opacity-50" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-64">
        <div className="flex items-center justify-between px-2 pt-2">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
            <ChevronLeft />
          </Button>
          <span className="text-sm font-medium">{MONTHS[view.m]}/{view.y}</span>
          <Button variant="ghost" size="icon" onClick={() => nav(1)}>
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 p-2">
          {WEEKDAYS.map((w) => (
            <span key={w} className="text-center text-xs text-muted-foreground">{w}</span>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const key = fmt(view.y, view.m, d);
            const selected = key === value;
            const isToday =
              today.getFullYear() === view.y &&
              today.getMonth() === view.m &&
              today.getDate() === d;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { onChange(key); setOpen(false); }}
                className={cn(
                  "cursor-pointer rounded-md px-1 py-1 text-sm hover:bg-accent",
                  selected && "bg-primary text-primary-foreground",
                  isToday && !selected && "font-semibold text-primary"
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
