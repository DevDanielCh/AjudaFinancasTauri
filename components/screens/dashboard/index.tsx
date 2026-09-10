"use client";
import { PlatformView } from "@/components/PlatformView";
import { DashboardDesktop } from "./desktop/DashboardDesktop";
import { DashboardMobile } from "./mobile/DashboardMobile";
import type { DashboardScreenProps } from "./types";

export function DashboardScreen(props: DashboardScreenProps) {
  return (
    <PlatformView
      mobile={<DashboardMobile {...props} />}
      desktop={<DashboardDesktop {...props} />}
    />
  );
}