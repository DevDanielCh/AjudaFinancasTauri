"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight, CalendarClock, CreditCard, Ellipsis,
  Landmark, LayoutDashboard, PiggyBank, RefreshCw, Tags,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/installments", label: "Parcelamentos", icon: CalendarClock },
] as const;

const MORE_GROUPS = [
  {
    label: "Organização Financeira",
    items: [
      { href: "/payment-methods", label: "Formas de Pagamento", icon: CreditCard },
      { href: "/categories", label: "Categorias", icon: Tags },
      { href: "/fixed-bills", label: "Contas Fixas", icon: RefreshCw },
      { href: "/loans", label: "Financiamentos", icon: Landmark },
    ],
  },
  {
    label: "Investimentos",
    items: [
      { href: "/reserva", label: "Reserva", icon: PiggyBank },
    ],
  },
] as const;

export function BottomBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-6 sm:hidden"
        style={{ bottom: "calc(0.75rem + var(--safe-area-inset-bottom))" }}
      >
        <div className="flex w-full max-w-xs items-center justify-between gap-1 rounded-full border border-background/60 bg-background/70 px-2 py-1.5 shadow-lg backdrop-blur-xl">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={cn(
                  "flex flex-1 items-center justify-center rounded-full py-2 text-muted-foreground transition-colors",
                  active && "bg-primary text-primary-foreground"
                )}
              >
                <Icon className="size-5" />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Mais"
            className="flex flex-1 items-center justify-center rounded-full py-2 text-muted-foreground"
          >
            <Ellipsis className="size-5" />
          </button>
        </div>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-1 pb-6">
          <SheetTitle className="sr-only">Mais</SheetTitle>
          {MORE_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col">
              <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-accent",
                    pathname.startsWith(href) && "bg-accent"
                  )}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </SheetContent>
      </Sheet>
    </>
  );
}
