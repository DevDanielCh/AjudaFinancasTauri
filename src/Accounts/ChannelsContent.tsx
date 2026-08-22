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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useMonth } from "@/lib/month-context";
import { getVersion } from "@/src/shared/repository";
import { useDashboard } from "@/src/shared/services";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { SyncStatusBadge } from "@/src/Sync/SyncStatus";
import { useAccounts } from "./services";

export const MODULE_GROUPS = [
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

interface ChannelsProps {
  onNavigate?: () => void;
}

export function ChannelsContent({ onNavigate }: ChannelsProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { month, setMonth, min } = useMonth();
  const { active } = useAccounts();
  const [version, setVersion] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
    getVersion().then(setVersion).catch(() => {});
  }, []);

  return (
    <div className="flex h-full flex-col gap-1">
      <div className="px-3 pt-3 pb-1">
        <MonthPicker value={month} onChange={setMonth} min={min} />
      </div>
      <div className="flex flex-col items-center gap-1 px-3">
        <MonthStatusBadge month={month} />
        <SyncStatusBadge />
      </div>
      <Separator className="my-1" />
      <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-2">
        <ChannelLink
          href="/"
          label="Dashboard"
          icon={<LayoutDashboard className="size-4 shrink-0" />}
          active={pathname === "/"}
          onClick={onNavigate}
        />
        {MODULE_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            {group.items.map(({ href, label, icon: Icon }) => (
              <ChannelLink
                key={href}
                href={href}
                label={label}
                icon={<Icon className="size-4 shrink-0" />}
                active={pathname.startsWith(href)}
                onClick={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>
      <Separator className="my-1" />
      <div className="flex items-center justify-between px-2 pb-2">
        <span className="truncate px-2 text-xs text-muted-foreground">{version}</span>
        <div className="flex items-center gap-1">
          <Link
            href="/configuracoes"
            onClick={onNavigate}
            aria-label="Configurações"
            className={cn(
              "flex size-7 items-center justify-center rounded-[min(var(--radius-md),12px)] hover:bg-accent",
              pathname.startsWith("/configuracoes") && "bg-accent"
            )}
          >
            <Settings className="size-4" />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Alternar tema"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {!mounted ? <Sun className="size-4" /> : resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </div>
      {active && (
        <p className="sr-only">Conta ativa: {active.name}</p>
      )}
    </div>
  );
}

function ChannelLink({
  href, label, icon, active, onClick,
}: {
  href: string; label: string; icon: React.ReactNode; active: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      data-slot="channel-link"
      className={cn(
        "flex select-none items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-accent text-sidebar-accent-foreground"
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function MonthStatusBadge({ month }: { month: string | null }) {
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
