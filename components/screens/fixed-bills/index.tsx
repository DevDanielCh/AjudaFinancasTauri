"use client";
import { Suspense } from "react";
import { PlatformView } from "@/components/PlatformView";
import type { CrudConfig } from "@/components/crud/types";
import { FixedBillsDesktop } from "./desktop/FixedBillsDesktop";
import { FixedBillsMobile } from "./mobile/FixedBillsMobile";

export function FixedBillsScreen<T extends { id: number }, F, E>({
  config,
}: {
  config: CrudConfig<T, F, E>;
}) {
  return (
    <Suspense fallback={null}>
      <PlatformView
      mobile={<FixedBillsMobile config={config} />}
      desktop={<FixedBillsDesktop config={config} />}
      />
    </Suspense>
  );
}