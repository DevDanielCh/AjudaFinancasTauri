"use client";

import { useSafeAreaInsets } from "@/lib/use-safe-area-insets";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";

export function SafeAreaInit() {
  useSafeAreaInsets();
  useKeyboardInset();
  return null;
}
