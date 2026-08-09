"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight, CalendarClock, Ellipsis, LayoutDashboard,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/installments", label: "Parcelamentos", icon: CalendarClock },
] as const;

const MORE = [
  { href: "/payment-methods", label: "Formas de Pagamento" },
  { href: "/categories", label: "Categorias" },
  { href: "/fixed-bills", label: "Contas Fixas" },
  { href: "/loans", label: "Financiamentos" },
] as const;

export function BottomBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-6 sm:hidden"
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
            aria-label="Mais"
            className="flex flex-1 items-center justify-center rounded-full py-2 text-muted-foreground"
          >
            <Ellipsis className="size-5" />
          </button>
        </div>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-1 pb-6">
          <SheetTitle className="px-4 pt-2 text-lg font-bold">Mais</SheetTitle>
          <div className="flex flex-col px-2">
            {MORE.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-3 text-sm font-medium hover:bg-accent",
                  pathname.startsWith(href) && "bg-accent"
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
