import { Keyboard } from "@capacitor/keyboard";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

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
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
      return;
    }

    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch((err) => {
      console.debug("[KeyboardObserver] setAccessoryBarVisible failed:", err);
    });

    Keyboard.addListener("keyboardWillShow", addScrollLock);
    Keyboard.addListener("keyboardDidHide", removeScrollLock);

    return () => {
      removeScrollLock();
      Keyboard.removeAllListeners();
    };
  }, []);

  return null;
}
