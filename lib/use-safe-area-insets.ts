"use client";

import { useEffect } from "react";

const IS_MOBILE =
  typeof window !== "undefined" &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function useSafeAreaInsets() {
  useEffect(() => {
    if (!IS_MOBILE) return;

    async function load() {
      try {
        const { getInsets } = await import("tauri-plugin-safe-area-insets");
        const insets = await getInsets();
        const root = document.documentElement;
        root.style.setProperty("--safe-area-inset-top", `${insets.top}px`);
        root.style.setProperty("--safe-area-inset-bottom", `${insets.bottom}px`);
        root.style.setProperty("--safe-area-inset-left", `${insets.left}px`);
        root.style.setProperty("--safe-area-inset-right", `${insets.right}px`);
      } catch {
        // Desktop or plugin not available — keep 0px defaults
      }
    }

    load();
  }, []);
}
