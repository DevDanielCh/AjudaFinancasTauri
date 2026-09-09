"use client";
import { CrudPageMobile } from "@/components/crud/CrudPageMobile";
import type { CrudConfig } from "@/components/crud/types";

export function InstallmentsMobile<T extends { id: number }, F, E>({
  config,
}: {
  config: CrudConfig<T, F, E>;
}) {
  return <CrudPageMobile config={config} />;
}