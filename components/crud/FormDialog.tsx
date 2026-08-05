"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import type { CrudConfig } from "./CrudPage";
import { msg } from "@/lib/api";

export function FormDialog<T extends { id: number }, F, E>({
  config, dialog, onClose, onSaved,
}: {
  config: CrudConfig<T, F, E>;
  dialog: { mode: "create" } | { mode: "edit"; row: T; input: F };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<F>(() =>
    dialog.mode === "create" ? config.empty() : dialog.input
  );
  const [resources, setResources] = useState<E | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    config.loadResources().then(setResources).catch((e) => setError(msg(e)));
  }, [config]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (dialog.mode === "create") {
        await config.create(value);
        toast.add({ title: "Salvo", type: "success" });
        onSaved();
        if (config.keepOpen) {
          setValue(config.empty());
        } else {
          onClose();
        }
      } else {
        await config.update(dialog.row.id, value);
        toast.add({ title: "Salvo", type: "success" });
        onSaved();
        onClose();
      }
    } catch (e) {
      setError(msg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialog.mode === "create" ? "Novo" : "Editar"}</DialogTitle>
        </DialogHeader>
        {resources === null ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : (
          <config.FormFields
            value={value}
            onChange={setValue}
            resources={resources}
            error={error}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
