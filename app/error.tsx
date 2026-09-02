"use client";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold">Algo deu errado</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Não foi possível carregar esta tela. Tente novamente.
      </p>
      <Button variant="outline" onClick={reset} className="mt-2">
        <RefreshCw data-icon="inline-start" />
        Tentar novamente
      </Button>
      {error?.digest && (
        <p className="text-xs text-muted-foreground">Código: {error.digest}</p>
      )}
    </div>
  );
}
