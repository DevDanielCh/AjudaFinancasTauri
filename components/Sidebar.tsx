"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight, CalendarClock, CreditCard, Landmark,
  LayoutDashboard, Moon, RefreshCw, Sun, Tags,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MonthPicker } from "@/components/MonthPicker";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useMonth } from "@/lib/month-context";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/payment-methods", label: "Formas de Pagamento", icon: CreditCard },
  { href: "/categories", label: "Categorias", icon: Tags },
  { href: "/fixed-bills", label: "Contas Fixas", icon: RefreshCw },
  { href: "/installments", label: "Parcelamentos", icon: CalendarClock },
  { href: "/loans", label: "Financiamentos", icon: Landmark },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { month, setMonth, min } = useMonth();
  const [version, setVersion] = useState("");

  useEffect(() => {
    api.getVersion().then(setVersion).catch(() => {});
  }, []);

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-2 border-r bg-muted/40 p-4">
      <div className="px-2 pt-1 text-lg font-bold tracking-tight">Ajuda Finanças</div>
      <MonthPicker value={month} onChange={setMonth} min={min} />
      <Separator className="my-1" />
      <Link
        href="/"
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
          pathname === "/" && "bg-accent"
        )}
      >
        <LayoutDashboard className="size-4" />
        Dashboard
      </Link>
      <Separator className="my-1" />
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
                active && "bg-accent"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <Button
        variant="ghost"
        className="justify-start"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
        Tema
      </Button>
      <Separator className="my-1" />
      <p className="text-center text-xs text-muted-foreground">{version}</p>
    </aside>
  );
}
