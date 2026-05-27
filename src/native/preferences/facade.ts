import { Capacitor } from "@capacitor/core";
import { NATIVE_PREFERENCES_PLUGIN_NAME } from "@aonsoku/capacitor-native/preferences";

export function isNativePreferencesAvailable(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "ios" &&
    Capacitor.isPluginAvailable(NATIVE_PREFERENCES_PLUGIN_NAME)
  );
}

export { AonsokuNativePreferences } from "@aonsoku/capacitor-native/preferences";
export type { AonsokuNativePreferencesPlugin } from "@aonsoku/capacitor-native/preferences";
