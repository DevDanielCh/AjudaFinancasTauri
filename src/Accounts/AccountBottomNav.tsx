"use client";
import { useRef, useState } from "react";
import { Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { MonthPicker } from "@/components/MonthPicker";
import { useMonth } from "@/lib/month-context";
import { cn } from "@/lib/utils";
import { foregroundOn, initials, type AccountInfo } from "./models";
import { useAccounts } from "./services";
import {
  AccountCreateDialog,
  AccountDeleteDialog,
  AccountEditDialog,
} from "./AccountDialogs";
import { AccountSwitcherSheet } from "./AccountSwitcherSheet";

export function AccountBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { active, isSwitching } = useAccounts();
  const { month, setMonth, min } = useMonth();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AccountInfo | null>(null);
  const [deleting, setDeleting] = useState<AccountInfo | null>(null);

  const settingsActive = pathname === "/configuracoes";

  return (
    <nav
      aria-label="Navegação"
      className="fixed left-1/2 z-40 flex h-14 w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 items-center justify-around rounded-2xl border border-border/60 bg-background/85 shadow-lg backdrop-blur-xl sm:hidden"
      style={{ bottom: "calc(0.75rem + var(--safe-area-inset-bottom))" }}
    >
      <NavButton
        label={active ? `Conta ${active.name}` : "Trocar conta"}
        disabled={isSwitching}
        onClick={() => setSwitcherOpen(true)}
        onLongPress={() => active && setEditing(active)}
      >
        {active ? (
          <span
            className="flex size-9 items-center justify-center rounded-full text-xs font-bold shadow-xs"
            style={{ backgroundColor: active.color, color: foregroundOn(active.color) }}
          >
            {initials(active.name)}
          </span>
        ) : (
          <span className="size-9 rounded-full bg-muted" />
        )}
      </NavButton>

      <div className="flex min-w-0 flex-[2] items-center justify-center px-1">
        <MonthPicker value={month} onChange={setMonth} min={min} compact />
      </div>

      <NavButton
        label="Configurações"
        active={settingsActive}
        onClick={() => router.push("/configuracoes")}
      >
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-full transition-colors",
            settingsActive && "bg-muted/80"
          )}
        >
          <Settings className="size-6" />
        </span>
      </NavButton>

      <AccountSwitcherSheet
        open={switcherOpen}
        onOpenChange={setSwitcherOpen}
        onNewAccount={() => {
          setSwitcherOpen(false);
          setCreating(true);
        }}
      />
      <AccountCreateDialog open={creating} onOpenChange={setCreating} />
      <AccountEditDialog
        account={editing}
        onClose={() => setEditing(null)}
        onDelete={(a) => {
          setEditing(null);
          setDeleting(a);
        }}
      />
      <AccountDeleteDialog account={deleting} onClose={() => setDeleting(null)} />
    </nav>
  );
}

function NavButton({
  label, children, onClick, active, disabled, onLongPress, className,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  onLongPress?: () => void;
  className?: string;
}) {
  const suppressClick = useRef(false);

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active ?? undefined}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onClick?.();
      }}
      onPointerDown={(e) => {
        suppressClick.current = false;
        if (!onLongPress || e.pointerType !== "touch") return;
        const sx = e.clientX;
        const sy = e.clientY;
        const t = window.setTimeout(() => {
          suppressClick.current = true;
          onLongPress();
        }, 500);
        const cancel = () => window.clearTimeout(t);
        const cleanup = () => {
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onMove);
          window.removeEventListener("pointermove", onMove);
        };
        const onUp = () => {
          cancel();
          cleanup();
        };
        const onMove = (ev: PointerEvent) => {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 10) return;
          cancel();
          cleanup();
        };
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onMove);
        window.addEventListener("pointermove", onMove);
      }}
      className={cn(
        "flex h-full min-w-0 flex-1 select-none items-center justify-center text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "text-foreground",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}