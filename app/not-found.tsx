import Link from "next/link";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-bold tabular-nums text-muted-foreground">404</p>
      <h1 className="text-xl font-bold">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        O endereço que você abriu não existe ou foi movido.
      </p>
      <Button render={<Link href="/" />} className="mt-2">
        <Home data-icon="inline-start" />
        Voltar ao início
      </Button>
    </div>
  );
}
