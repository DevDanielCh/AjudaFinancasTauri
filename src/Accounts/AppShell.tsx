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
import type { AccountInfo } from "./models";

function Shell({ children }: { children: React.ReactNode }) {
  const { channelsOpen, setChannelsOpen } = useAccounts();
  const [editing, setEditing] = useState<AccountInfo | null>(null);
  const [deleting, setDeleting] = useState<AccountInfo | null>(null);

  return (
    <div className="flex h-screen">
      <AccountRail />

      {/* Sidebar fixa no desktop */}
      <aside
        data-slot="channels-sidebar"
        className="hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar md:flex"
      >
        <ChannelsContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <main className="flex-1 p-3 pb-20 sm:p-4">{children}</main>
      </div>

      {/* Drawer de canais no mobile */}
      <Sheet open={channelsOpen} onOpenChange={setChannelsOpen}>
        <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Navegação</SheetTitle>
            <SheetDescription>Menu principal do aplicativo</SheetDescription>
          </SheetHeader>
          <ChannelsContent onNavigate={() => setChannelsOpen(false)} />
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
