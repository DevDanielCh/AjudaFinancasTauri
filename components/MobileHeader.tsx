"use client";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MonthPicker } from "@/components/MonthPicker";
import { Button } from "@/components/ui/button";
import { useMonth } from "@/lib/month-context";

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

export function MobileHeader() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { month, setMonth, min } = useMonth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const title = TITLES[pathname] ?? "Ajuda Finanças";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md sm:hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <h1 className="truncate text-base font-bold tracking-tight">{title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <MonthPicker value={month} onChange={setMonth} min={min} compact />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Alternar tema"
          >
            {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>
      </div>
    </header>
  );
}
