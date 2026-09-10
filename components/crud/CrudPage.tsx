"use client";
import { Suspense } from "react";
import { PlatformView } from "@/components/PlatformView";
import { CrudPageDesktop } from "./CrudPageDesktop";
import { CrudPageMobile } from "./CrudPageMobile";
import type { CrudConfig, DialogState } from "./types";

export type { CrudConfig, DialogState };

export function CrudPage<T extends { id: number }, F, E>({
  config,
  autoCreate,
}: {
  config: CrudConfig<T, F, E>;
  autoCreate?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <PlatformView
        mobile={<CrudPageMobile config={config} autoCreate={autoCreate} />}
        desktop={<CrudPageDesktop config={config} autoCreate={autoCreate} />}
      />
    </Suspense>
  );
}