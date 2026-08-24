"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { MonthPicker } from "@/components/MonthPicker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { Spinner } from "@/components/ui/spinner";
import { useSettings, useUpdateSettings, useRevalidateGenerated } from "@/src/shared/services";
import { msg } from "@/src/shared/repository";
import type { Settings } from "@/src/shared/models";
import { SyncSettings } from "@/src/Sync/SyncSettings";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function ConfiguracoesPage() {
  const { data: settings, isLoading } = useSettings();
  if (isLoading || !settings) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="sincronizacao">Sincronização</TabsTrigger>
        </TabsList>
        <TabsContent value="geral">
          <div className="flex flex-col gap-4">
            <SettingsForm key={JSON.stringify(settings)} settings={settings} />
            <MaintenanceCard />
          </div>
        </TabsContent>
        <TabsContent value="sincronizacao">
          <SyncSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsForm({ settings }: { settings: Settings }) {
  const [primeiroMes, setPrimeiroMes] = useState(settings.primeiro_mes ?? "");
  const [conta, setConta] = useState(settings.saldo_inicial_conta);
  const [reserva, setReserva] = useState(settings.saldo_inicial_reserva);
  const [meta, setMeta] = useState(settings.meta_investimento);
  const update = useUpdateSettings();

  const save = () =>
    update.mutate(
      {
        primeiro_mes: primeiroMes === "" ? null : primeiroMes,
        saldo_inicial_conta: conta,
        saldo_inicial_reserva: reserva,
        meta_investimento: meta,
      },
      {
        onSuccess: () => toast.add({ title: "Configurações salvas", type: "success" }),
        onError: (e) => toast.add({ title: msg(e), type: "error" }),
      }
    );

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Análises</CardTitle></CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Primeiro mês de uso</FieldLabel>
            <MonthPicker value={primeiroMes} onChange={setPrimeiroMes} />
            <p className="text-xs text-muted-foreground">
              Nenhum dado anterior a esse mês entra nos dashboards.
            </p>
          </Field>
          <Field>
            <FieldLabel>Saldo inicial da conta (R$)</FieldLabel>
            <MoneyInput value={conta} onChange={setConta} />
            <p className="text-xs text-muted-foreground">
              Quanto existia na conta no primeiro mês de uso.
            </p>
          </Field>
          <Field>
            <FieldLabel>Saldo inicial da reserva (R$)</FieldLabel>
            <MoneyInput value={reserva} onChange={setReserva} />
            <p className="text-xs text-muted-foreground">
              Quanto existia na reserva no primeiro mês de uso.
            </p>
          </Field>
          <Field>
            <FieldLabel>Meta de investimento (% da renda)</FieldLabel>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={meta}
              onChange={(e) => setMeta(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Percentual das receitas do mês destinado a investimentos.
            </p>
          </Field>
          <Button onClick={save} disabled={update.isPending} className="w-full">
            {update.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function MaintenanceCard() {
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
