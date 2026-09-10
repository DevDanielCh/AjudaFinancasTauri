"use client";
import { ConfiguracoesScreen } from "@/components/screens/configuracoes";
import { useSettings } from "@/src/shared/services";

export default function ConfiguracoesPage() {
  const { data: settings, isLoading } = useSettings();
  if (isLoading || !settings) {
    return null;
  }
  return <ConfiguracoesScreen settings={settings} />;
}