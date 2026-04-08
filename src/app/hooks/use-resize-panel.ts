import clamp from "lodash/clamp";
import { useCallback, useEffect, useRef } from "react";

interface UseResizePanelConfig {
  cssVar: string;
  min: number;
  max: number;
  defaultWidth: number;
  direction: "left" | "right";
  onWidthChange: (width: number) => void;
}

export function useResizePanel({
  cssVar,
  min,
  max,
  defaultWidth,
  direction,
  onWidthChange,
}: UseResizePanelConfig) {
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const lastWidthRef = useRef(defaultWidth);

  const setVariable = useCallback(
    (width: number) => {
      document.documentElement.style.setProperty(cssVar, `${width}px`);
    },
    [cssVar],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizingRef.current) return;

      const delta = e.clientX - startXRef.current;
      const multiplier = direction === "right" ? 1 : -1;
      const newWidth = clamp(
        startWidthRef.current + delta * multiplier,
        min,
        max,
      );

      lastWidthRef.current = newWidth;
      setVariable(newWidth);
    },
    [direction, min, max, setVariable],
  );

  const handleMouseUp = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;

    document.body.classList.remove("is-resizing");
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    onWidthChange(lastWidthRef.current);
  }, [handleMouseMove, onWidthChange]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingRef.current = true;
      startXRef.current = e.clientX;

      const raw = document.documentElement.style.getPropertyValue(cssVar);
      startWidthRef.current = raw ? parseInt(raw, 10) : defaultWidth;
      lastWidthRef.current = startWidthRef.current;

      document.body.classList.add("is-resizing");
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [cssVar, defaultWidth, handleMouseMove, handleMouseUp],
  );

  const handleDoubleClick = useCallback(() => {
    lastWidthRef.current = defaultWidth;
    setVariable(defaultWidth);
    onWidthChange(defaultWidth);
  }, [defaultWidth, setVariable, onWidthChange]);

  useEffect(() => {
    return () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.classList.remove("is-resizing");
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      }
    };
  }, [handleMouseMove, handleMouseUp]);

  return { handleMouseDown, handleDoubleClick };
}
