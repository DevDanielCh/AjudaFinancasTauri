"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSelect, type FormSelectOption } from "./FormSelect";

export function QuickCreateSelect({
  value,
  onChange,
  options,
  placeholder,
  createLabel,
  createPrompt,
  size = "lg",
  loading,
  onCreate,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  /** Label do botão de criar (ex.: "Nova categoria"). */
  createLabel?: string;
  /** Placeholder do input de criação. */
  createPrompt?: string;
  size?: "default" | "lg";
  /** Desabilita botão/+ enquanto resources carregam. */
  loading?: boolean;
  /** Cria o item. Retorno void; o pai invalida os resources para a opção aparecer. */
  onCreate: (name: string) => Promise<void>;
  className?: string;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setCreating(true);
    setName("");
    setError(null);
  };

  const confirm = async () => {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    try {
      await onCreate(trimmed);
      setCreating(false);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex w-full items-stretch gap-1.5">
        <FormSelect
          value={value}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          size={size}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={createLabel}
          disabled={loading}
          onClick={open}
          className={cn(size === "lg" && "h-11 w-11")}
        >
          <Plus />
        </Button>
      </div>
      {creating && (
        <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
          <div className="flex items-center gap-1.5">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void confirm();
                }
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder={createPrompt}
              size={size}
              autoFocus
              disabled={pending}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Cancelar"
              onClick={() => setCreating(false)}
              disabled={pending}
              className={cn("shrink-0", size === "lg" && "h-11 w-11")}
            >
              <Plus className="rotate-45" />
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2">
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <span className="text-xs text-muted-foreground">{createPrompt}</span>
            )}
            <Button
              type="button"
              className="rounded-md"
              onClick={() => void confirm()}
              disabled={!name.trim() || pending}
            >
              {pending ? "Criando..." : createLabel ?? "Criar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}