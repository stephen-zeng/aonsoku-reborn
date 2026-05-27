import { useEffect, useRef } from "react";

export function useScrollEndListener(
  getElement: () => HTMLElement | null,
  handler: () => void,
  deps: unknown[],
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const el = getElement();
    if (!el) return;

    if ("onscrollend" in el) {
      const listener = () => handlerRef.current();
      el.addEventListener("scrollend", listener);
      return () => el.removeEventListener("scrollend", listener);
    }

    let timer: ReturnType<typeof setTimeout>;
    let isTouching = false;
    let pendingFire = false;

    const fire = () => {
      pendingFire = false;
      handlerRef.current();
    };

    const onScroll = () => {
      pendingFire = false;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (isTouching) {
          pendingFire = true;
        } else {
          fire();
        }
      }, 150);
    };

    const onTouchStart = () => {
      isTouching = true;
      pendingFire = false;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        isTouching = false;
        if (pendingFire) {
          clearTimeout(timer);
          timer = setTimeout(fire, 150);
        }
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: deps forwarded from caller
  }, deps);
}
