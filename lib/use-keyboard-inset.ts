"use client";

import { useEffect } from "react";

const IS_MOBILE =
  typeof window !== "undefined" &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Altura do teclado virtual em px. visualViewport-based, overlay e resize. */
export function useKeyboardInset() {
  useEffect(() => {
    if (!IS_MOBILE) return;

    const root = document.documentElement;

    const update = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const keyboard = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
      root.style.setProperty("--vkbd-h", `${keyboard}px`);
    };

    update();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);
}