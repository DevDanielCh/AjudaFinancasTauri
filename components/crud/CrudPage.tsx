"use client";
import { Suspense } from "react";
import { usePlatform } from "@/lib/platform";
import type { CrudConfig, DialogState } from "./types";
import { CrudPageDesktop } from "./CrudPageDesktop";
import { CrudPageMobile } from "./CrudPageMobile";

export type { CrudConfig, DialogState };
export type { Column } from "./types";

export function CrudPage<T extends { id: number }, F, E>({
  config,
  autoCreate,
}: {
  config: CrudConfig<T, F, E>;
  autoCreate?: boolean;
}) {
  return (
    <Suspense>
      <CrudPageInner config={config} autoCreate={autoCreate} />
    </Suspense>
  );
}

function CrudPageInner<T extends { id: number }, F, E>({
  config,
  autoCreate,
}: {
  config: CrudConfig<T, F, E>;
  autoCreate?: boolean;
}) {
  const platform = usePlatform();
  return platform === "mobile" ? (
    <CrudPageMobile config={config} autoCreate={autoCreate} />
  ) : (
    <CrudPageDesktop config={config} autoCreate={autoCreate} />
  );
}