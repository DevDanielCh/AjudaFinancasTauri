"use client";
import { CrudPageDesktop } from "@/components/crud/CrudPageDesktop";
import type { CrudConfig } from "@/components/crud/types";

export function PaymentMethodsDesktop<T extends { id: number }, F, E>({
  config,
}: {
  config: CrudConfig<T, F, E>;
}) {
  return <CrudPageDesktop config={config} />;
}