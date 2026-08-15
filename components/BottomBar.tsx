"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight, CalendarClock, CreditCard, Landmark,
  MoreHorizontal, PiggyBank, RefreshCw, Settings, Tags,
} from "lucide-react";
import { useState } from "react";
import {
  Sheet, SheetContent, SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const MANUAL = [
  { label: "Transações", href: "/transactions", icon: ArrowLeftRight },
  { label: "Contas Fixas", href: "/fixed-bills", icon: RefreshCw },
  { label: "Parcelamentos", href: "/installments", icon: CalendarClock },
  { label: "Financiamentos", href: "/loans", icon: Landmark },
  { label: "Reserva", href: "/reserva", icon: PiggyBank },
];

const MORE = [
  { label: "Formas de Pagamento", href: "/payment-methods", icon: CreditCard },
  { label: "Categorias", href: "/categories", icon: Tags },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];

export function BottomBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isMoreActive = ["/payment-methods", "/categories", "/configuracoes"].some(
    (h) => pathname.startsWith(h)
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-6 sm:hidden"
      >
        <div className="flex w-full max-w-sm items-center justify-between gap-1 rounded-full border border-background/60 bg-background/70 px-2 py-1.5 shadow-lg backdrop-blur-xl">
          {MANUAL.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={cn(
                  "flex flex-1 items-center justify-center rounded-full py-2 text-muted-foreground transition-colors",
                  active && "bg-foreground text-background"
                )}
              >
                <Icon className="size-5" />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 pb-1 pt-1.5 text-[10px] font-medium transition-colors",
              "text-muted-foreground",
              isMoreActive && "text-foreground"
            )}
          >
            <MoreHorizontal className="size-6" />
            Mais
          </button>
        </div>
      </nav>

      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="w-full rounded-t-2xl pb-10"
      >
        <div className="mb-2 flex w-full items-center justify-center">
          <div className="h-1.5 w-10 rounded-full bg-muted" />
        </div>
        <SheetTitle className="sr-only">Mais</SheetTitle>
        <div className="grid grid-cols-3 gap-2 px-2">
          {MORE.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg py-3 text-xs font-medium",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
