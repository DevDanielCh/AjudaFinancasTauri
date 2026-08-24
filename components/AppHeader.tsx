"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Settings, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MonthStatusBadge } from "@/components/MonthStatusBadge";
import { Button } from "@/components/ui/button";
import { useMonth } from "@/lib/month-context";
import { cn } from "@/lib/utils";
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
  const { resolvedTheme, setTheme } = useTheme();
  const { month } = useMonth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const title = TITLES[pathname] ?? "Ajuda Finanças";

  return (
    <header
      className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md"
      style={{ paddingTop: "var(--safe-area-inset-top)" }}
    >
      {/* Altura casa com o divider da rail: pt(8) + botão(36/40) + mt(4) + meia-altura(1). */}
      <div className="flex h-[49px] items-center gap-2 px-3 sm:h-[53px] sm:px-4">
        <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <span className="hidden lg:flex"><MonthStatusBadge month={month} /></span>
            <SyncStatusBadge />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Alternar tema"
          >
            {!mounted ? <Sun className="size-5" /> : resolvedTheme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
          <Link
            href="/configuracoes"
            aria-label="Configurações"
            className={cn(
              "flex size-8 items-center justify-center rounded-md hover:bg-accent",
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
