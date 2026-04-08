import { useCallback, useEffect, useRef } from "react";
import { FullscreenPlayerTab } from "@/types/playerContext";

const TAB_ORDER: FullscreenPlayerTab[] = ["queue", "playing", "lyrics"];
const SWIPE_THRESHOLD = 50;

export function useSwipeTabs(
  currentTab: FullscreenPlayerTab,
  setTab: (tab: FullscreenPlayerTab) => void,
) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const currentTabRef = useRef(currentTab);

  useEffect(() => {
    currentTabRef.current = currentTab;
  }, [currentTab]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = touch.clientY - touchStart.current.y;
      touchStart.current = null;

      // Prevent vertical scroll from triggering tab swipes
      if (
        Math.abs(deltaX) < SWIPE_THRESHOLD ||
        Math.abs(deltaX) < Math.abs(deltaY)
      ) {
        return;
      }

      const currentIndex = TAB_ORDER.indexOf(currentTabRef.current);
      const nextIndex =
        deltaX < 0
          ? Math.min(currentIndex + 1, TAB_ORDER.length - 1)
          : Math.max(currentIndex - 1, 0);

      if (nextIndex !== currentIndex) {
        setTab(TAB_ORDER[nextIndex]);
      }
    },
    [setTab],
  );

  return { onTouchStart, onTouchEnd };
}
