"use client";
import { useCallback, useRef } from "react";

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * Long-press para Android WebView (lições AGENTS.md):
 * - micro-jitter do dedo não cancela o timer (só >10px de deslocamento);
 * - click após long-press é suprimido e o flag reseta no próximo pointerdown;
 * - NÃO usar junto com onContextMenu no Android.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const suppressClick = useRef(false);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Reset do suppress no novo toque (browser pode não disparar
      // click no mesmo elemento após long-press).
      suppressClick.current = false;
      startX.current = e.clientX;
      startY.current = e.clientY;
      clearTimer();
      timer.current = setTimeout(() => {
        suppressClick.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    [onLongPress, clearTimer]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!timer.current) return;
      const dist = Math.hypot(e.clientX - startX.current, e.clientY - startY.current);
      if (dist > MOVE_TOLERANCE_PX) clearTimer();
    },
    [clearTimer]
  );

  const onPointerUp = useCallback(() => clearTimer(), [clearTimer]);
  const onPointerCancel = useCallback(() => clearTimer(), [clearTimer]);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
    }
  }, []);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClickCapture,
    },
  };
}
