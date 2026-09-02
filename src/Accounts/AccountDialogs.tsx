"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
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
    <Button type="submit" disabled={disabled || pending}>
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

  const body = (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Nova conta</DialogTitle>
        <DialogDescription>
          Cada conta tem dados totalmente independentes.
        </DialogDescription>
      </DialogHeader>
      <AccountFormBody value={value} onChange={setValue} />
      {createMutation.isError && (
        <p className="text-sm text-destructive">{String(createMutation.error)}</p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={reset}>
          Cancelar
        </Button>
        <SubmitButton pending={createMutation.isPending} disabled={!value.name?.trim()}>
          Criar
        </SubmitButton>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
        <SheetContent side="bottom">
          <SheetHeader className="sr-only">
            <SheetTitle>Nova conta</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-sm">{body}</DialogContent>
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

  const body = account && (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Editar conta</DialogTitle>
      </DialogHeader>
      <AccountFormBody value={value} onChange={setValue} />
      {updateMutation.isError && (
        <p className="text-sm text-destructive">{String(updateMutation.error)}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={!canDelete}
          title={canDelete ? undefined : "Não é possível excluir a última conta"}
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(account)}
        >
          Excluir
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <SubmitButton pending={updateMutation.isPending} disabled={!value.name?.trim()}>
            Salvar
          </SubmitButton>
        </div>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <Sheet open={!!account} onOpenChange={(o) => { if (!o) close(); }}>
        <SheetContent side="bottom">
          <SheetHeader className="sr-only">
            <SheetTitle>Editar conta</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={!!account} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="sm:max-w-sm">{body}</DialogContent>
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

  const body = account && (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Excluir “{account.name}”?</DialogTitle>
        <DialogDescription>
          Todas as transações, categorias, formas de pagamento, contas fixas e
          empréstimos dessa conta serão apagados permanentemente. Essa ação não
          pode ser desfeita.
        </DialogDescription>
      </DialogHeader>
      {deleteMutation.isError && (
        <p className="text-sm text-destructive">{String(deleteMutation.error)}</p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={deleteMutation.isPending}
          onClick={confirm}
        >
          {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Excluir tudo
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={!!account} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent side="bottom">
          <SheetHeader className="sr-only">
            <SheetTitle>Excluir conta</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={!!account} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">{body}</DialogContent>
    </Dialog>
  );
}
