"use client";
import { Suspense } from "react";
import { PlatformView } from "@/components/PlatformView";
import type { CrudConfig } from "@/components/crud/types";
import { PaymentMethodsDesktop } from "./desktop/PaymentMethodsDesktop";
import { PaymentMethodsMobile } from "./mobile/PaymentMethodsMobile";

export function PaymentMethodsScreen<T extends { id: number }, F, E>({
  config,
}: {
  config: CrudConfig<T, F, E>;
}) {
  return (
    <Suspense fallback={null}>
      <PlatformView
      mobile={<PaymentMethodsMobile config={config} />}
      desktop={<PaymentMethodsDesktop config={config} />}
      />
    </Suspense>
  );
}