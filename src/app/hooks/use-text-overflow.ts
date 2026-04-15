import { useCallback, useLayoutEffect, useRef, useState } from "react";

interface OverflowState {
  width: number;
  height: number;
  isOverflowing: boolean;
}

interface UseTextOverflowReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  textRef: React.RefObject<HTMLDivElement | null>;
  overflow: OverflowState;
  calculateOverflow: () => void;
}

export function useTextOverflow(): UseTextOverflowReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<OverflowState>({
    width: 0,
    height: 0,
    isOverflowing: false,
  });

  const calculateOverflow = useCallback(() => {
    if (!containerRef.current || !textRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const measuredWidth = textRef.current.scrollWidth;
    const measuredHeight = textRef.current.offsetHeight;
    const isOverflowing = measuredWidth > containerWidth;

    setOverflow((prev) =>
      prev.width === measuredWidth &&
      prev.height === measuredHeight &&
      prev.isOverflowing === isOverflowing
        ? prev
        : {
            width: measuredWidth,
            height: measuredHeight,
            isOverflowing,
          },
    );
  }, []);

  useLayoutEffect(() => {
    let rafId: number;
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(calculateOverflow);
    };

    calculateOverflow();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(rafId);
    };
  }, [calculateOverflow]);

  return { containerRef, textRef, overflow, calculateOverflow };
}
