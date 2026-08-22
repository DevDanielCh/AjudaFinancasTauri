"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight, CalendarClock, CreditCard, Landmark,
  LayoutDashboard, Moon, PiggyBank, RefreshCw, Settings, Sun, Tags,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MonthPicker } from "@/components/MonthPicker";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useMonth } from "@/lib/month-context";
import { getVersion } from "@/src/shared/repository";
import { useDashboard } from "@/src/shared/services";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { SyncStatusBadge } from "@/src/Sync/SyncStatus";

const MODULE_GROUPS = [
  {
    label: "Organização Financeira",
    items: [
      { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
      { href: "/fixed-bills", label: "Contas Fixas", icon: RefreshCw },
      { href: "/installments", label: "Parcelamentos", icon: CalendarClock },
      { href: "/loans", label: "Financiamentos", icon: Landmark },
      { href: "/payment-methods", label: "Formas de Pagamento", icon: CreditCard },
      { href: "/categories", label: "Categorias", icon: Tags },
    ],
  },
  {
    label: "Investimentos",
    items: [
      { href: "/reserva", label: "Reserva", icon: PiggyBank },
    ],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { month, setMonth, min } = useMonth();
  const [version, setVersion] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
    getVersion().then(setVersion).catch(() => {});
  }, []);

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col gap-2 border-r bg-muted/40 p-4 sm:flex">
      <MonthPicker value={month} onChange={setMonth} min={min} />
      <MonthStatusBadge month={month} />
      <SyncStatusBadge />
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
      <nav className="flex flex-1 flex-col gap-3">
        {MODULE_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
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
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-1">
        <Link
          href="/configuracoes"
          aria-label="Configurações"
          className={cn(
            "flex size-8 items-center justify-center rounded-md hover:bg-accent",
            pathname.startsWith("/configuracoes") && "bg-accent"
          )}
        >
          <Settings className="size-4" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label="Alternar tema"
        >
          {!mounted ? <Sun className="size-4" /> : resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
      <Separator className="my-1" />
      <p className="text-center text-xs text-muted-foreground">{version}</p>
    </aside>
  );
}

function MonthStatusBadge({ month }: { month: string | null }) {
  const { data } = useDashboard(month);
  if (!data) return null;
  const balance = data.income - data.expenses;
  const metaValor = Math.round((data.income * data.meta_investimento) / 100);
  const bateuMeta = metaValor > 0 && data.aportes >= metaValor;
  const sobrou = balance > 0;
  const abs = Math.abs(balance);
  const variant = sobrou && bateuMeta ? "positive" : sobrou ? "yellow" : "negative";
  const label = sobrou ? `Sobrou ${formatMoney(abs)}` : `Faltou ${formatMoney(abs)}`;
  return (
    <Badge
      className={cn(
        "w-full text-xs",
        variant === "positive" && "bg-positive text-positive-foreground",
        variant === "negative" && "bg-negative text-negative-foreground",
        variant === "yellow" && "bg-sticker-orange text-white",
      )}
    >
      {label}
    </Badge>
  );
}
