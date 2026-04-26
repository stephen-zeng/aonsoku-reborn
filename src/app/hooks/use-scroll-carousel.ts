import { useCallback, useEffect, useRef, useState } from "react";

interface UseScrollCarouselReturn {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  handleScroll: (direction: "prev" | "next") => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  scrollCarouselProps: {
    ref: React.RefObject<HTMLDivElement | null>;
    role: string;
    "aria-roledescription": string;
    tabIndex: number;
    onKeyDown: (e: React.KeyboardEvent) => void;
  };
}

const SCROLL_EPSILON = 1;
const SCROLL_AMOUNT_RATIO = 0.6;

export function useScrollCarousel(ariaLabel?: string): UseScrollCarouselReturn {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const tickingRef = useRef(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollPrev(scrollLeft > SCROLL_EPSILON);
    setCanScrollNext(scrollLeft + SCROLL_EPSILON < maxScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        updateScrollButtons();
        tickingRef.current = false;
      });
    };

    updateScrollButtons();
    el.addEventListener("scroll", onScroll, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollButtons);
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
    };
  }, [updateScrollButtons]);

  const handleScroll = useCallback((direction: "prev" | "next") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * SCROLL_AMOUNT_RATIO;
    el.scrollBy({
      left: direction === "next" ? scrollAmount : -scrollAmount,
      behavior: "smooth",
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleScroll("prev");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleScroll("next");
      }
    },
    [handleScroll],
  );

  const scrollCarouselProps = {
    ref: scrollRef,
    role: "region" as const,
    "aria-roledescription": "carousel",
    ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
    tabIndex: 0,
    onKeyDown: handleKeyDown,
  };

  return {
    scrollRef,
    canScrollPrev,
    canScrollNext,
    handleScroll,
    handleKeyDown,
    scrollCarouselProps,
  };
}
