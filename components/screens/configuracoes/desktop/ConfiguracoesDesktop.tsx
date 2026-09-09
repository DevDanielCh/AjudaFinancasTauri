"use client";
import { SyncSettings } from "@/src/Sync/SyncSettings";
import type { Settings } from "@/src/shared/models";
import { SettingsForm } from "../shared/SettingsForm";
import { MaintenanceCard } from "../shared/MaintenanceCard";

export function ConfiguracoesDesktop({ settings }: { settings: Settings }) {
  return (
    <div className="grid flex-1 items-start gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <SettingsForm key={JSON.stringify(settings)} settings={settings} />
        <MaintenanceCard />
      </div>
      <SyncSettings />
    </div>
  );
}