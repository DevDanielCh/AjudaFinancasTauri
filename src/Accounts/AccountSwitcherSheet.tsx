"use client";
import { Check, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { foregroundOn, initials } from "./models";
import { useAccounts } from "./services";

export function AccountSwitcherSheet({
  open,
  onOpenChange,
  onNewAccount,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onNewAccount: () => void;
}) {
  const { accounts, active, switchTo, isSwitching } = useAccounts();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="gap-2 pb-4">
        <SheetHeader>
          <SheetTitle>Trocar conta</SheetTitle>
          <SheetDescription>Selecione a conta para usar no app.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-1">
          {accounts.map((account) => {
            const isActive = !!active && account.uuid === active.uuid;
            return (
              <button
                key={account.uuid}
                type="button"
                disabled={isSwitching}
                onClick={() => switchTo(account.uuid)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-accent",
                  isActive && "border-primary/50 bg-primary/5"
                )}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-xs"
                  style={{ backgroundColor: account.color, color: foregroundOn(account.color) }}
                >
                  {initials(account.name)}
                </span>
                <span className="flex-1 truncate text-sm font-medium">{account.name}</span>
                {isActive && (
                  <Check className="size-4 shrink-0 text-primary" aria-label="Conta ativa" />
                )}
              </button>
            );
          })}
          {accounts.length === 0 && (
            <p className="px-1 py-4 text-center text-sm text-muted-foreground">
              {isSwitching ? "Carregando..." : "Nenhuma conta encontrada."}
            </p>
          )}
        </div>

        <Button
          variant="outline"
          className="mt-1 w-full justify-start text-left"
          onClick={onNewAccount}
        >
          <Plus data-icon="inline-start" />
          Nova conta
        </Button>
      </SheetContent>
    </Sheet>
  );
}