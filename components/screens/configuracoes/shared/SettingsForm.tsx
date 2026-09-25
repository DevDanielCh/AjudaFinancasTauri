"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { MonthPicker } from "@/components/MonthPicker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { useUpdateSettings } from "@/src/shared/services";
import { msg } from "@/src/shared/repository";
import type { Settings } from "@/src/shared/models";

export function SettingsForm({ settings }: { settings: Settings }) {
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
            <MonthPicker size="lg" value={primeiroMes} onChange={setPrimeiroMes} />
            <FieldDescription>Nenhum dado anterior a esse mês entra nos dashboards.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Saldo inicial da conta (R$)</FieldLabel>
            <MoneyInput size="lg" value={conta} onChange={setConta} />
            <FieldDescription>Quanto existia na conta no primeiro mês de uso.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Saldo inicial da reserva (R$)</FieldLabel>
            <MoneyInput size="lg" value={reserva} onChange={setReserva} />
            <FieldDescription>Quanto existia na reserva no primeiro mês de uso.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Meta de investimento (% da renda)</FieldLabel>
            <Input
              size="lg"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={meta}
              onChange={(e) => setMeta(Number(e.target.value))}
            />
            <FieldDescription>
              Percentual das receitas do mês destinado a investimentos.
            </FieldDescription>
          </Field>
          <Button onClick={save} disabled={update.isPending} size="lg" className="w-full rounded-md">
            {update.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}