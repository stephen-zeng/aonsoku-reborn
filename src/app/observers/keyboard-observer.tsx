import { Keyboard } from "@capacitor/keyboard";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";
import { useAppStore } from "@/store/app.store";

export function KeyboardObserver() {
  const commandOpen = useAppStore((state) => state.command.open);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    if (Capacitor.getPlatform() === "ios") {
      Keyboard.setAccessoryBarVisible({ isVisible: false }).catch((err) => {
        console.debug("[KeyboardObserver] setAccessoryBarVisible failed:", err);
      });
    }

    if (commandOpen) {
      return;
    }

    let keyboardVisible = false;

    const onShow = () => {
      keyboardVisible = true;
    };

    const onHide = () => {
      keyboardVisible = false;
    };

    const onScroll = () => {
      if (keyboardVisible) {
        Keyboard.hide();
      }
    };

    Keyboard.addListener("keyboardWillShow", onShow);
    Keyboard.addListener("keyboardDidShow", onShow);
    Keyboard.addListener("keyboardWillHide", onHide);
    Keyboard.addListener("keyboardDidHide", onHide);
    document.addEventListener("scroll", onScroll, { capture: true });

    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      Keyboard.removeAllListeners();
    };
  }, [commandOpen]);

  return null;
}
