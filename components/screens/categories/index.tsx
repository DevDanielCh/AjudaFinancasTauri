"use client";
import { Suspense } from "react";
import { PlatformView } from "@/components/PlatformView";
import type { CrudConfig } from "@/components/crud/types";
import { CategoriesDesktop } from "./desktop/CategoriesDesktop";
import { CategoriesMobile } from "./mobile/CategoriesMobile";

export function CategoriesScreen<T extends { id: number }, F, E>({
  config,
}: {
  config: CrudConfig<T, F, E>;
}) {
  return (
    <Suspense fallback={null}>
      <PlatformView
      mobile={<CategoriesMobile config={config} />}
      desktop={<CategoriesDesktop config={config} />}
      />
    </Suspense>
  );
}