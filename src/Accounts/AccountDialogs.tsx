"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/lib/use-is-mobile";
import { ACCOUNT_COLORS, foregroundOn, initials, type AccountInfo, type AccountInput } from "./models";
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from "./services";

function AccountFormBody({
  value,
  onChange,
}: {
  value: AccountInput;
  onChange: (v: AccountInput) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="account-name" className="text-sm font-medium">
          Nome
        </label>
        <Input
          id="account-name"
          value={value.name ?? ""}
          placeholder="ex.: Pessoal, Empresa…"
          autoFocus
          maxLength={30}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Cor</span>
        <div className="flex flex-wrap items-center gap-2">
          {ACCOUNT_COLORS.map((color) => {
            const selected = (value.color ?? ACCOUNT_COLORS[0]) === color;
            return (
              <button
                key={color}
                type="button"
                aria-label={`Cor ${color}`}
                aria-pressed={selected}
                onClick={() => onChange({ ...value, color })}
                style={{ backgroundColor: color }}
                className={`size-8 rounded-full transition-all ${
                  selected
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : ""
                }`}
              >
                <span className="text-[10px] font-bold" style={{ color: foregroundOn(color) }}>
                  {initials(value.name || "A")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SubmitButton({
  pending,
  disabled,
  children,
}: {
  pending: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button type="submit" className="rounded-md" disabled={disabled || pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}

export function AccountCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const createMutation = useCreateAccount();
  const [value, setValue] = useState<AccountInput>({ name: "", color: ACCOUNT_COLORS[0] });

  const reset = () => {
    setValue({ name: "", color: ACCOUNT_COLORS[0] });
    onOpenChange(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.name?.trim()) return;
    createMutation.mutate(value, { onSuccess: reset });
  };

  const fields = (
    <>
      <AccountFormBody value={value} onChange={setValue} />
      {createMutation.isError && (
        <p className="text-sm text-destructive">{String(createMutation.error)}</p>
      )}
    </>
  );

  const actions = (
    <>
      <Button type="button" variant="outline" onClick={reset}>
        Cancelar
      </Button>
      <SubmitButton pending={createMutation.isPending} disabled={!value.name?.trim()}>
        Criar
      </SubmitButton>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
        <SheetContent side="top" className="max-h-[92dvh] overflow-y-auto">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <SheetHeader className="mb-4">
              <SheetTitle>Nova conta</SheetTitle>
            </SheetHeader>
            {fields}
            <SheetFooter className="mt-6">{actions}</SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nova conta</DialogTitle>
            <DialogDescription>
              Cada conta tem dados totalmente independentes.
            </DialogDescription>
          </DialogHeader>
          {fields}
          <DialogFooter className="mt-6">{actions}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AccountEditDialog({
  account,
  onClose,
  onDelete,
}: {
  account: AccountInfo | null;
  onClose?: () => void;
  onDelete: (account: AccountInfo) => void;
}) {
  const isMobile = useIsMobile();
  const updateMutation = useUpdateAccount();
  const { accounts } = useAccounts();
  const [value, setValue] = useState<AccountInput>({});

  useEffect(() => {
    if (!account) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue({ name: account.name, color: account.color });
  }, [account]);

  const close = () => {
    updateMutation.reset();
    onClose?.();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !value.name?.trim()) return;
    updateMutation.mutate(
      { uuid: account.uuid, input: { name: value.name.trim(), color: value.color } },
      { onSuccess: close }
    );
  };

  const canDelete = !!account && accounts.length > 1;

  const fields = account && (
    <>
      <AccountFormBody value={value} onChange={setValue} />
      {updateMutation.isError && (
        <p className="text-sm text-destructive">{String(updateMutation.error)}</p>
      )}
    </>
  );

  const actions = (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={!canDelete}
        title={canDelete ? undefined : "Não é possível excluir a última conta"}
        className="mr-auto text-destructive hover:text-destructive"
        onClick={() => account && onDelete(account)}
      >
        Excluir
      </Button>
      <Button type="button" variant="outline" onClick={close}>
        Cancelar
      </Button>
      <SubmitButton pending={updateMutation.isPending} disabled={!value.name?.trim()}>
        Salvar
      </SubmitButton>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={!!account} onOpenChange={(o) => { if (!o) close(); }}>
        <SheetContent side="top" className="max-h-[92dvh] overflow-y-auto">
          {account && (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <SheetHeader className="mb-4">
                <SheetTitle>Editar conta</SheetTitle>
              </SheetHeader>
              {fields}
              <SheetFooter className="mt-6">{actions}</SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={!!account} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="sm:max-w-sm">
        {account && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Editar conta</DialogTitle>
            </DialogHeader>
            {fields}
            <DialogFooter className="mt-6">{actions}</DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AccountDeleteDialog({
  account,
  onClose,
}: {
  account: AccountInfo | null;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const deleteMutation = useDeleteAccount();

  const confirm = () => {
    if (!account) return;
    deleteMutation.mutate(account.uuid, { onSuccess: onClose });
  };

  const description = account && (
    <DialogDescription>
      Todas as transações, categorias, formas de pagamento, contas fixas e
      empréstimos dessa conta serão apagados permanentemente. Essa ação não
      pode ser desfeita.
    </DialogDescription>
  );

  const actions = (
    <>
      <Button type="button" variant="outline" onClick={onClose}>
        Cancelar
      </Button>
      <Button
        type="button"
        variant="destructive"
        className="rounded-md"
        disabled={deleteMutation.isPending}
        onClick={confirm}
      >
        {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Excluir tudo
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={!!account} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent side="top">
          {account && (
            <div className="flex flex-col gap-4">
              <SheetHeader className="mb-4">
                <SheetTitle>Excluir “{account.name}”?</SheetTitle>
              </SheetHeader>
              {description}
              {deleteMutation.isError && (
                <p className="text-sm text-destructive">{String(deleteMutation.error)}</p>
              )}
              <SheetFooter className="mt-6">{actions}</SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={!!account} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        {account && (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Excluir “{account.name}”?</DialogTitle>
              {description}
            </DialogHeader>
            {deleteMutation.isError && (
              <p className="text-sm text-destructive">{String(deleteMutation.error)}</p>
            )}
            <DialogFooter className="mt-6">{actions}</DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}