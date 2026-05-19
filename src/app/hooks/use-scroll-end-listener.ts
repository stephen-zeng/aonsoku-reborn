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
    const listener = () => {
      clearTimeout(timer);
      timer = setTimeout(() => handlerRef.current(), 150);
    };
    el.addEventListener("scroll", listener, { passive: true });
    return () => {
      clearTimeout(timer);
      el.removeEventListener("scroll", listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
