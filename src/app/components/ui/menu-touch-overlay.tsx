import * as React from "react";
import { useIsTouchPrimary } from "@/app/hooks/use-input-mode";

export const MenuCloseContext = React.createContext<(() => void) | null>(null);

export function MenuTouchOverlay() {
  const isTouchPrimary = useIsTouchPrimary();
  const close = React.useContext(MenuCloseContext);

  if (!isTouchPrimary || !close) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 49,
        pointerEvents: "auto",
        touchAction: "manipulation",
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "touch") {
          React.startTransition(() => close());
        }
      }}
    />
  );
}
