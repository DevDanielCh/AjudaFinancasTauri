"use client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SyncSettings } from "@/src/Sync/SyncSettings";
import type { Settings } from "@/src/shared/models";
import { SettingsForm } from "../shared/SettingsForm";
import { MaintenanceCard } from "../shared/MaintenanceCard";

export function ConfiguracoesMobile({ settings }: { settings: Settings }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
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