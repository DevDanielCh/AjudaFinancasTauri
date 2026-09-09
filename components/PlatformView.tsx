"use client";
import { usePlatform } from "@/lib/platform";

export function PlatformView({
  mobile,
  desktop,
}: {
  mobile: React.ReactNode;
  desktop: React.ReactNode;
}) {
  const platform = usePlatform();
  return platform === "mobile" ? mobile : desktop;
}