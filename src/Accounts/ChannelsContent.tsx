"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight, CalendarClock, ChevronLeft, ChevronRight, CreditCard, Landmark,
  LayoutDashboard, PiggyBank, RefreshCw, Tags,
} from "lucide-react";
import { MonthPicker } from "@/components/MonthPicker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MonthStatusBadge } from "@/components/MonthStatusBadge";
import { SyncStatusBadge } from "@/src/Sync/SyncStatus";
import { useMonth } from "@/lib/month-context";
import { shiftMonth } from "@/lib/format";
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
  /** Exibe pílulas de status do mês/sync (usado no drawer mobile). */
  showStatus?: boolean;
}

export function ChannelsContent({ onNavigate, showStatus }: ChannelsProps) {
  const pathname = usePathname();
  const { month, setMonth, min } = useMonth();
  const { active } = useAccounts();

  return (
    <div className="flex h-full flex-col gap-1">
      {/* Filtro global de mês; altura/borda alinham com o header fixo
          e com o divider da rail (pt 8 + botão 36/40 + mt 4 + 1). */}
      <div
        className="flex h-[calc(57px_+_var(--safe-area-inset-top))] shrink-0 items-center border-b px-2"
        style={{ paddingTop: "var(--safe-area-inset-top)" }}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mês anterior"
          disabled={!month || month <= min}
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex min-w-0 flex-1 justify-center">
          <MonthPicker value={month} onChange={setMonth} min={min} compact />
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Próximo mês"
          disabled={!month}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      {/* Padding vertical alinhado ao layout entre o header e o conteúdo. */}
      <div className="flex min-h-0 flex-1 flex-col pt-[10px]">
        {showStatus && (
          <div className="flex flex-col gap-1 px-3">
            <MonthStatusBadge month={month} className="w-full" />
            <SyncStatusBadge className="w-full" />
          </div>
        )}
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
      </div>
      {active && (
        <p className="sr-only px-4 pb-2">Conta ativa: {active.name}</p>
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
        "flex select-none items-center gap-2 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground",
        active && "bg-sidebar-accent text-sidebar-accent-foreground"
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}
