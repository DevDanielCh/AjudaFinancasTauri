"use client";
import { PlatformView } from "@/components/PlatformView";
import type { Settings } from "@/src/shared/models";
import { ConfiguracoesDesktop } from "./desktop/ConfiguracoesDesktop";
import { ConfiguracoesMobile } from "./mobile/ConfiguracoesMobile";

export function ConfiguracoesScreen({ settings }: { settings: Settings }) {
  return (
    <PlatformView
      mobile={<ConfiguracoesMobile settings={settings} />}
      desktop={<ConfiguracoesDesktop settings={settings} />}
    />
  );
}