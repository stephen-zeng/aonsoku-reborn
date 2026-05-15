import { Keyboard } from "@capacitor/keyboard";
import { useEffect } from "react";

/**
 * Observer to handle keyboard related configurations for mobile/Capacitor.
 */
export function KeyboardObserver() {
  useEffect(() => {
    // Hide the accessory bar (the bar with arrows and "Done" above the keyboard on iOS)
    // This only affects iOS as Android doesn't have an accessory bar.
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch((err) => {
      // Silently catch errors if the plugin is not available or supported on the current platform
      console.debug("[KeyboardObserver] setAccessoryBarVisible failed:", err);
    });
  }, []);

  return null;
}
