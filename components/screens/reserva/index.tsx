"use client";
import { Suspense } from "react";
import { PlatformView } from "@/components/PlatformView";
import type { CrudConfig } from "@/components/crud/types";
import { ReservaDesktop } from "./desktop/ReservaDesktop";
import { ReservaMobile } from "./mobile/ReservaMobile";

export function ReservaScreen<T extends { id: number }, F, E>({
  config,
}: {
  config: CrudConfig<T, F, E>;
}) {
  return (
    <Suspense fallback={null}>
      <PlatformView
      mobile={<ReservaMobile config={config} />}
      desktop={<ReservaDesktop config={config} />}
      />
    </Suspense>
  );
}