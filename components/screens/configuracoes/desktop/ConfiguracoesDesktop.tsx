"use client";
import { SyncSettings } from "@/src/Sync/SyncSettings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Settings } from "@/src/shared/models";
import { SettingsForm } from "../shared/SettingsForm";
import { MaintenanceCard } from "../shared/MaintenanceCard";

export function ConfiguracoesDesktop({ settings }: { settings: Settings }) {
  return (
    <div className="grid flex-1 items-start gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Aparência</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Tema do aplicativo</span>
            <ThemeToggle />
          </CardContent>
        </Card>
        <SettingsForm key={JSON.stringify(settings)} settings={settings} />
        <MaintenanceCard />
      </div>
      <SyncSettings />
    </div>
  );
}