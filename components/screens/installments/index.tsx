"use client";
import { Suspense } from "react";
import { PlatformView } from "@/components/PlatformView";
import type { CrudConfig } from "@/components/crud/types";
import { InstallmentsDesktop } from "./desktop/InstallmentsDesktop";
import { InstallmentsMobile } from "./mobile/InstallmentsMobile";

export function InstallmentsScreen<T extends { id: number }, F, E>({
  config,
}: {
  config: CrudConfig<T, F, E>;
}) {
  return (
    <Suspense fallback={null}>
      <PlatformView
      mobile={<InstallmentsMobile config={config} />}
      desktop={<InstallmentsDesktop config={config} />}
      />
    </Suspense>
  );
}