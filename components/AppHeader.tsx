"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Settings } from "lucide-react";
import { MonthStatusBadge } from "@/components/MonthStatusBadge";
import { Button } from "@/components/ui/button";
import { useMonth } from "@/lib/month-context";
import { cn } from "@/lib/utils";
import { useAccounts } from "@/src/Accounts/services";
import { SyncStatusBadge } from "@/src/Sync/SyncStatus";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/transactions": "Transações",
  "/reserva": "Reserva",
  "/installments": "Parcelamentos",
  "/fixed-bills": "Contas Fixas",
  "/loans": "Financiamentos",
  "/categories": "Categorias",
  "/payment-methods": "Formas de Pagamento",
  "/configuracoes": "Configurações",
};

export function AppHeader() {
  const pathname = usePathname();
  const { month } = useMonth();
  const { channelsOpen, setChannelsOpen } = useAccounts();

  const title = TITLES[pathname] ?? "Ajuda Finanças";

  return (
    <header
      className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md"
      style={{ paddingTop: "var(--safe-area-inset-top)" }}
    >
      {/* h-14 fixo (56px). */}
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Navegação"
          aria-pressed={channelsOpen}
          onClick={() => setChannelsOpen(true)}
          className={cn("sm:hidden", channelsOpen && "bg-accent")}
        >
          <Menu className="size-5" />
        </Button>

        <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <SyncStatusBadge />
          </div>
          <MonthStatusBadge month={month} />
          <Link
            href="/configuracoes"
            aria-label="Configurações"
            className={cn(
              "hidden sm:flex size-8 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
              pathname.startsWith("/configuracoes") && "bg-accent"
            )}
          >
            <Settings className="size-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}