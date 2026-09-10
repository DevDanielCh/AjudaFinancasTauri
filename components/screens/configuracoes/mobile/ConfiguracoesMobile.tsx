"use client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SyncSettings } from "@/src/Sync/SyncSettings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        </TabsContent>
        <TabsContent value="sincronizacao">
          <SyncSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}