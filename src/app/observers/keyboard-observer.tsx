import { Keyboard } from "@capacitor/keyboard";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";
import { useAppStore } from "@/store/app.store";

const SCROLL_LOCK_CLASS = "keyboard-scroll-lock";

function addScrollLock() {
  document.documentElement.classList.add(SCROLL_LOCK_CLASS);
  document.body.classList.add(SCROLL_LOCK_CLASS);
}

function removeScrollLock() {
  document.documentElement.classList.remove(SCROLL_LOCK_CLASS);
  document.body.classList.remove(SCROLL_LOCK_CLASS);
}

export function KeyboardObserver() {
  const commandOpen = useAppStore((state) => state.command.open);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
      return;
    }

    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch((err) => {
      console.debug("[KeyboardObserver] setAccessoryBarVisible failed:", err);
    });

    if (commandOpen) {
      removeScrollLock();
      return;
    }

    Keyboard.addListener("keyboardWillShow", addScrollLock);
    Keyboard.addListener("keyboardDidHide", removeScrollLock);

    return () => {
      removeScrollLock();
      Keyboard.removeAllListeners();
    };
  }, [commandOpen]);

  return null;
}
