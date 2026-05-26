import { useCallback, useEffect, useRef, useState } from "react";
import { useHaptic } from "@/app/hooks/use-haptic";

interface UseTouchMenuGuardOptions {
  hapticOnLongPress?: boolean;
  longPressDuration?: number;
  moveThreshold?: number;
}

export function useTouchMenuGuard(options?: UseTouchMenuGuardOptions) {
  const {
    hapticOnLongPress = true,
    longPressDuration = 500,
    moveThreshold = 10,
  } = options ?? {};

  const [open, setOpen] = useState(false);
  const { trigger: hapticTrigger } = useHaptic();
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedByLongPress = useRef(false);
  const hasMoved = useRef(false);

  const clearTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      startPos.current = { x: e.clientX, y: e.clientY };
      openedByLongPress.current = false;
      hasMoved.current = false;
      e.stopPropagation();

      clearTimer();
      longPressTimer.current = setTimeout(() => {
        if (startPos.current && !hasMoved.current) {
          openedByLongPress.current = true;
          setOpen(true);
          if (hapticOnLongPress && hapticTrigger) hapticTrigger("medium");
        }
      }, longPressDuration);
    },
    [clearTimer, hapticOnLongPress, hapticTrigger, longPressDuration],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "touch" || !startPos.current) return;
      const dx = Math.abs(e.clientX - startPos.current.x);
      const dy = Math.abs(e.clientY - startPos.current.y);
      if (dx > moveThreshold || dy > moveThreshold) {
        hasMoved.current = true;
        clearTimer();
      }
    },
    [clearTimer, moveThreshold],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      clearTimer();
      if (!startPos.current) return;

      const dx = Math.abs(e.clientX - startPos.current.x);
      const dy = Math.abs(e.clientY - startPos.current.y);
      startPos.current = null;

      if (hasMoved.current || dx > moveThreshold || dy > moveThreshold) return;
      if (openedByLongPress.current) return;

      e.stopPropagation();
      setOpen(true);
    },
    [clearTimer, moveThreshold],
  );

  const onPointerCancel = useCallback(() => {
    clearTimer();
    startPos.current = null;
  }, [clearTimer]);

  const onClick = useCallback((e: React.MouseEvent) => {
    const isTouch =
      e.nativeEvent instanceof PointerEvent &&
      e.nativeEvent.pointerType === "touch";
    if (isTouch) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    setOpen(true);
  }, []);

  const onContextMenu = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
  }, []);

  return {
    open,
    setOpen,
    triggerProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClick,
      onContextMenu,
      className: "touch-pan-y select-none",
    },
  };
}
