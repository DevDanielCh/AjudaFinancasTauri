"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { skipToken } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import type { FormValidateFn } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Spinner } from "@/components/ui/spinner";
import { FieldError } from "@/components/ui/field";
import { FormErrorSummary } from "@/components/forms/FormErrorSummary";
import { toast } from "@/components/ui/toast";
import { useIsMobile } from "@/lib/use-is-mobile";
import { cn } from "@/lib/utils";
import { msg } from "@/src/shared/repository";
import { useStore } from "@/lib/forms";
import type { CrudConfig, DialogState } from "./types";
import type { CrudFormApi } from "@/lib/forms";

/** Singular genérico: remove apenas o "s" final (título irregular vem via config). */
function singular(title: string): string {
  return title.endsWith("s") ? title.slice(0, -1) : title;
}

const hasMessage = (e: unknown) =>
  typeof e === "string" || (typeof (e as { message?: string })?.message === "string");

export function FormDialog<T extends { id: number }, F, E>({
  config,
  dialog,
  onClose,
  onSaved,
  variant,
}: {
  config: CrudConfig<T, F, E>;
  dialog: DialogState<T, F>;
  onClose: () => void;
  onSaved?: () => void;
  /** Plataforma alvo. Quando omisso, decide pelo breakpoint (legado). */
  variant?: "sheet" | "dialog";
}) {
  const isMobile = useIsMobile();
  const variant_ = variant ?? (isMobile ? "sheet" : "dialog");
  const [attempted, setAttempted] = useState(false);
  const [batchCount, setBatchCount] = useState(0);

  const form = useForm({
    defaultValues:
      dialog.mode === "edit"
        ? dialog.input
        : "input" in dialog
          ? dialog.input ?? config.empty()
          : config.empty(),
    validators: { onChange: config.schema as unknown as FormValidateFn<F> },
    onSubmit: ({ value }) => mutation.mutate(value),
  });

  const mutation = useMutation({
    mutationFn: (value: F) =>
      dialog.mode === "edit" ? config.update(dialog.row.id, value) : config.create(value),
    onSuccess: () => {
      toast.add({ title: "Salvo", type: "success" });
      onSaved?.();
      setAttempted(false);
      if (dialog.mode === "create" && config.keepOpen) {
        setBatchCount((c) => c + 1);
        form.reset(config.empty());
      } else {
        onClose();
      }
    },
  });

  const serverError = mutation.isError ? msg(mutation.error) : null;

  const resourcesQuery = useQuery({
    queryKey: [...config.queryKey, "resources"],
    queryFn: config.loadResources ?? skipToken,
    enabled: config.loadResources != null,
  });
  const resources = resourcesQuery.data as E | undefined;
  const resourcesLoading = config.loadResources != null && resourcesQuery.isLoading;
  const resourcesError =
    config.loadResources != null && resourcesQuery.isError ? msg(resourcesQuery.error) : null;

const errorCount = useStore(form.store, (s) =>
    (
      Object.values(s.fieldMeta) as Array<{
        errors?: unknown[];
        touched?: boolean;
        blurred?: boolean;
      }>
    ).filter((m) => m.errors?.some(hasMessage) && (m.touched || m.blurred)).length
  );
  const showSummary = attempted && errorCount > 0;

  useEffect(() => {
    if (!showSummary) return;
    const el = document.querySelector<HTMLElement>('[data-slot="field-error"]');
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus();
  }, [showSummary]);

  useEffect(() => {
    if (resourcesLoading || resourcesError) return;
    const container = document.querySelector(
      '[data-slot="sheet-content"], [data-slot="dialog-panel"]'
    );
    const input = container?.querySelector<HTMLElement>('[data-slot="input"]');
    if (input && !input.hasAttribute("disabled")) {
      input.focus({ preventScroll: true });
    }
  }, [resourcesLoading, resourcesError]);

  if (dialog.mode === "view") return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    void form.handleSubmit();
  };

  const body = resourcesLoading ? (
    <div className="flex justify-center py-4">
      <Spinner />
    </div>
  ) : resourcesError ? (
    <FieldError>{resourcesError}</FieldError>
  ) : (
    <config.FormFields
      form={form as unknown as CrudFormApi<F>}
      resources={resources}
      serverError={serverError}
    />
  );

  const title =
    (dialog.mode === "edit"
      ? config.editTitle ?? `Editar ${singular(config.title)}`
      : config.newTitle ?? `Novo ${singular(config.title)}`) +
    (batchCount > 0 ? ` · ${batchCount + 1}` : "");

  const actions = (
    <>
      <Button type="button" variant="outline" onClick={onClose}>
        Cancelar
      </Button>
      <form.Subscribe selector={(s) => [s.isSubmitting, s.canSubmit, s.isPristine] as const}>
        {([isSubmitting, canSubmit, isPristine]) => (
          <Button type="submit" className="rounded-md" disabled={!canSubmit || isPristine || isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        )}
      </form.Subscribe>
    </>
  );

  const summary = showSummary && (
    <FormErrorSummary count={errorCount} onReset={() => setAttempted(false)} />
  );

  if (variant_ === "sheet") {
    return (
      <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent
          side="top"
          className={cn("flex flex-col overflow-hidden", "max-h-[85dvh]")}
        >
          <form
            onSubmit={submit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <SheetHeader className="shrink-0 border-b">
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto pt-4 pb-6">
              {summary}
              {body}
            </div>
            <SheetFooter className="mt-0 shrink-0 border-t bg-popover/95 pt-3 pb-[calc(var(--safe-area-inset-bottom)+0.75rem)] backdrop-blur-sm">
              {actions}
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {summary}
          {body}
          <DialogFooter className="mt-6">{actions}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}