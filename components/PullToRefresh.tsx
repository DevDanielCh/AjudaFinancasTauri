"use client";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 64;
const MAX_PULL = 140;

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const refreshRef = useRef(onRefresh);
  const touch = useRef({ startY: 0, startX: 0, active: false });

  useEffect(() => {
    refreshRef.current = onRefresh;
  });

  useEffect(() => {
    const isInsideScrollable = (el: Element | null): boolean => {
      while (el && el !== document.documentElement) {
        if (el === document.body) {
          el = el.parentElement;
          continue;
        }
        if (el.matches?.('[data-slot="sheet-content"], [data-slot="dialog-panel"]')) return true;
        const oy = getComputedStyle(el).overflowY;
        if (oy === "auto" || oy === "scroll" || oy === "overlay") return true;
        el = el.parentElement;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      const t = touch.current;
      t.active = window.scrollY <= 0 && !refreshingRef.current && !isInsideScrollable(e.target as Element | null);
      t.startY = e.touches[0].clientY;
      t.startX = e.touches[0].clientX;
      if (t.active) pullRef.current = 0;
    };

    const onMove = (e: TouchEvent) => {
      const t = touch.current;
      if (!t.active) return;
      const dy = e.touches[0].clientY - t.startY;
      const dx = e.touches[0].clientX - t.startX;
      if (dy > 0 && dy >= Math.abs(dx) && window.scrollY <= 0) {
        const d = Math.min(dy, MAX_PULL);
        pullRef.current = d;
        setPull(d);
        e.preventDefault();
      } else if (pullRef.current > 0) {
        pullRef.current = 0;
        setPull(0);
      }
    };

    const finish = (run: boolean) => {
      const t = touch.current;
      t.active = false;
      if (run && pullRef.current >= THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPull(THRESHOLD);
        Promise.resolve(refreshRef.current()).finally(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          setPull(0);
        });
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    };

    const onEnd = () => finish(true);
    const onCancel = () => finish(false);

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
    };
  }, []);

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
        style={{ transform: `translateY(${pull}px)` }}
      >
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "mt-2 flex size-9 items-center justify-center rounded-full border bg-background shadow-xs transition-opacity",
            pull === 0 && "opacity-0"
          )}
        >
          <RefreshCw className={cn("size-4 text-muted-foreground", refreshing && "animate-spin")} />
          {refreshing && <span className="sr-only">Atualizando dados...</span>}
        </div>
      </div>
      {children}
    </>
  );
}
