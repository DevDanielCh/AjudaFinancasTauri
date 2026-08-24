"use client";
import { House, Pencil, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ContextMenu } from "@base-ui/react/context-menu";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/use-is-mobile";
import { getVersion } from "@/src/shared/repository";
import { initials, type AccountInfo } from "./models";
import { useAccounts } from "./services";
import {
  AccountCreateDialog,
  AccountDeleteDialog,
  AccountEditDialog,
} from "./AccountDialogs";

export function AccountRail() {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { accounts, active, switchTo, isSwitching, setChannelsOpen, channelsOpen } = useAccounts();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AccountInfo | null>(null);
  const [deleting, setDeleting] = useState<AccountInfo | null>(null);
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  const homeActive = pathname === "/";

  const handleCircleTap = (account: AccountInfo) => {
    if (isSwitching) return;
    if (active && account.uuid === active.uuid) {
      // Tocar na conta ativa abre a lista de canais.
      if (isMobile) setChannelsOpen(!channelsOpen);
      return;
    }
    switchTo(account.uuid);
    if (isMobile) setChannelsOpen(false);
  };

  return (
    <aside
      className="flex h-screen w-[60px] shrink-0 flex-col items-center gap-1.5 bg-rail py-2 sm:w-[72px]"
      style={{ paddingTop: "max(0.5rem, var(--safe-area-inset-top))" }}
    >
      <RailButton
        label="Dashboard"
        active={homeActive}
        onClick={() => router.push("/")}
        className={cn(
          "bg-muted text-muted-foreground hover:rounded-xl hover:bg-primary hover:text-primary-foreground",
          homeActive && "rounded-xl bg-primary text-primary-foreground"
        )}
      >
        <House className="size-5" />
      </RailButton>

      <div className="mx-auto my-0.5 h-0.5 w-7 rounded-full bg-muted-foreground/30" />

      <div className="flex w-full flex-1 flex-col items-center gap-3 overflow-y-auto py-1">
        {accounts.map((account) => (
          <AccountCircle
            key={account.uuid}
            account={account}
            isActive={!!active && account.uuid === active.uuid}
            disabled={isSwitching}
            onTap={() => handleCircleTap(account)}
            onEdit={() => setEditing(account)}
            onDelete={() => setDeleting(account)}
            canDelete={accounts.length > 1}
          />
        ))}

        <RailButton
          label="Nova conta"
          onClick={() => setCreating(true)}
          className="border border-dashed border-muted-foreground/60 text-positive hover:border-positive hover:bg-positive/10 hover:text-positive hover:rounded-xl"
        >
          <Plus className="size-5" />
        </RailButton>
      </div>

      {version && (
        <span
          title={`Versão ${version}`}
          className="pb-1 text-[10px] leading-none text-muted-foreground select-none"
          style={{ paddingBottom: "max(0.25rem, var(--safe-area-inset-bottom))" }}
        >
          v{version}
        </span>
      )}

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
    </aside>
  );
}


function RailButton({
  label, children, onClick, className, active,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "group relative flex size-9 shrink-0 select-none items-center justify-center rounded-full transition-all duration-150 sm:size-10",
        active ? "" : "hover:rounded-xl",
        className
      )}
    >
      {children}
    </button>
  );
}

function AccountCircle({
  account, isActive, disabled, onTap, onEdit, onDelete, canDelete,
}: {
  account: AccountInfo;
  isActive: boolean;
  disabled: boolean;
  onTap: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  return (
    <ContextMenu.Root>
      <div className="group relative flex w-full justify-center">
        {/* Indicador da conta ativa */}
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 left-0 z-10 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-all duration-200",
            isActive ? "h-8" : "h-0 group-hover:h-3.5"
          )}
        />
        <ContextMenu.Trigger
          render={
            <button
              type="button"
              aria-label={`Conta ${account.name}`}
              title={`${account.name}`}
              aria-current={isActive ? "true" : undefined}
              onClick={onTap}
              style={{ backgroundColor: account.color }}
              className={cn(
                "flex size-9 shrink-0 cursor-context-menu select-none items-center justify-center rounded-full text-sm font-bold text-white shadow-xs transition-all duration-150 sm:size-10",
                !isActive && "hover:rounded-xl",
                isActive && "rounded-xl ring-2 ring-primary",
                disabled && "pointer-events-none opacity-50"
              )}
            >
              {initials(account.name)}
            </button>
          }
        />
      </div>
      <AccountContextMenuContent
        onEdit={onEdit}
        onDelete={onDelete}
        canDelete={canDelete}
        headerLabel={account.name}
      />
    </ContextMenu.Root>
  );
}

function AccountContextMenuContent({
  onEdit, onDelete, canDelete, headerLabel,
}: {
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
  headerLabel?: string;
}) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner side="right" align="start" sideOffset={8}>
        <ContextMenu.Popup
          data-slot="context-menu-content"
          className="z-50 min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          {headerLabel && (
            <>
              <p
                data-slot="context-menu-label"
                className="truncate px-1.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {headerLabel}
              </p>
              <ContextMenu.Separator className="-mx-1 my-1 h-px bg-border" />
            </>
          )}
          <ContextMenuItem onClick={onEdit}>
            <Pencil className="size-4" />
            Editar
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            disabled={!canDelete}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
            Excluir
          </ContextMenuItem>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}

function ContextMenuItem({
  variant, className, ...props
}: React.ComponentProps<typeof ContextMenu.Item> & { variant?: "default" | "destructive" }) {
  return (
    <ContextMenu.Item
      data-slot="context-menu-item"
      data-variant={variant}
      className={cn(
        "group/context-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      {...props}
    />
  );
}
