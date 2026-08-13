"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { skipToken } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import type { FormValidateFn } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
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
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { FieldError } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { useIsMobile } from "@/lib/use-is-mobile";
import { msg } from "@/lib/api";
import type { CrudConfig, DialogState } from "./CrudPage";
import type { CrudFormApi } from "@/lib/forms";

export function FormDialog<T extends { id: number }, F, E>({
  config,
  dialog,
  onClose,
}: {
  config: CrudConfig<T, F, E>;
  dialog: DialogState<T, F>;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const isMobile = useIsMobile();

  const form = useForm({
    defaultValues: dialog.mode === "create" ? config.empty() : dialog.input,
    validators: { onChange: config.schema as unknown as FormValidateFn<F> },
    onSubmit: ({ value }) => mutation.mutate(value),
  });

  const mutation = useMutation({
    mutationFn: (value: F) =>
      dialog.mode === "edit" ? config.update(dialog.row.id, value) : config.create(value),
    onSuccess: () => {
      toast.add({ title: "Salvo", type: "success" });
      void client.invalidateQueries({ queryKey: config.queryKey, exact: true });
      for (const key of config.invalidate ?? []) {
        void client.invalidateQueries({ queryKey: key });
      }
      if (dialog.mode === "create" && config.keepOpen) {
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

  const actions = (
    <>
      <Button type="button" variant="outline" onClick={onClose}>
        Cancelar
      </Button>
      <form.Subscribe selector={(s) => [s.isSubmitting, s.canSubmit, s.isPristine] as const}>
        {([isSubmitting, canSubmit, isPristine]) => (
          <Button type="submit" disabled={!canSubmit || isPristine || isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        )}
      </form.Subscribe>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent>
          <form onSubmit={form.handleSubmit}>
            <SheetHeader className="mb-4">
              <SheetTitle>
                {dialog.mode === "edit" ? "Editar" : "Novo"} {config.title.slice(0, -1)}
              </SheetTitle>
              <SheetDescription />
            </SheetHeader>
            {body}
            <SheetFooter className="mt-6">{actions}</SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <form onSubmit={form.handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {dialog.mode === "edit" ? "Editar" : "Novo"} {config.title.slice(0, -1)}
            </DialogTitle>
            <DialogDescription />
          </DialogHeader>
          {body}
          <DialogFooter className="mt-6">{actions}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
