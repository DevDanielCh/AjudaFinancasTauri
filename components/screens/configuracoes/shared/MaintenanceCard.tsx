"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { useRevalidateGenerated } from "@/src/shared/services";
import { msg } from "@/src/shared/repository";

export function MaintenanceCard() {
  const revalidate = useRevalidateGenerated();

  const run = () =>
    revalidate.mutate(undefined, {
      onSuccess: () => toast.add({ title: "Transações revalidadas", type: "success" }),
      onError: (e) => toast.add({ title: msg(e), type: "error" }),
    });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Manutenção</CardTitle></CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <p className="text-xs text-muted-foreground">
              Recria as transações geradas por empréstimos e parcelamentos
              (entradas, parcelas mensais) e atualiza as faturas de cartão,
              de todos os meses até o atual. Movimentos da reserva não são
              alterados.
            </p>
          </Field>
          <Button onClick={run} disabled={revalidate.isPending} className="w-full">
            {revalidate.isPending ? "Revalidando..." : "Revalidar transações"}
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}