"use client";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AccountsProvider, useAccounts } from "./services";
import { AccountRail } from "./AccountRail";
import { AccountEditDialog, AccountDeleteDialog } from "./AccountDialogs";
import { ChannelsContent } from "./ChannelsContent";
import { AppHeader } from "@/components/AppHeader";
import type { AccountInfo } from "./models";

function Shell({ children }: { children: React.ReactNode }) {
  const { channelsOpen, setChannelsOpen } = useAccounts();
  const [editing, setEditing] = useState<AccountInfo | null>(null);
  const [deleting, setDeleting] = useState<AccountInfo | null>(null);

  return (
    <div className="flex h-full">
      <AccountRail />

      {/* Sidebar fixa no desktop */}
      <aside
        data-slot="channels-sidebar"
        className="hidden h-full w-60 shrink-0 flex-col border-r bg-sidebar md:flex"
      >
        <ChannelsContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 pb-20 sm:p-6">
          <div className="mx-auto flex w-full max-w-7xl flex-1">{children}</div>
        </main>
      </div>

      {/* Drawer de canais no mobile */}
      <Sheet open={channelsOpen} onOpenChange={setChannelsOpen}>
        <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Navegação</SheetTitle>
            <SheetDescription>Menu principal do aplicativo</SheetDescription>
          </SheetHeader>
          <ChannelsContent onNavigate={() => setChannelsOpen(false)} showStatus />
        </SheetContent>
      </Sheet>

      <AccountEditDialog
        account={editing}
        onClose={() => setEditing(null)}
        onDelete={(a) => {
          setEditing(null);
          setDeleting(a);
        }}
      />
      <AccountDeleteDialog account={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AccountsProvider>
      <Shell>{children}</Shell>
    </AccountsProvider>
  );
}
