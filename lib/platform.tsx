"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";

export type Platform = "mobile" | "desktop";

const PlatformContext = createContext<Platform>("desktop");

async function resolvePlatform(): Promise<Platform> {
  if (isTauri()) {
    try {
      const p = await invoke<string>("get_platform_type");
      return p === "mobile" ? "mobile" : "desktop";
    } catch {
      // comando indisponível: cai no fallback por largura
    }
  }
  return window.matchMedia("(max-width: 639px)").matches ? "mobile" : "desktop";
}

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  // default "desktop" preserva o SSR/hydration; resolve a plataforma após mount.
  const [platform, setPlatform] = useState<Platform>("desktop");

  useEffect(() => {
    let active = true;
    void resolvePlatform().then((p) => {
      if (active) setPlatform(p);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>
  );
}

export function usePlatform(): Platform {
  return useContext(PlatformContext);
}