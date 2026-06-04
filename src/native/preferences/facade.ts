import { Capacitor } from "@capacitor/core";
import { NATIVE_PREFERENCES_PLUGIN_NAME } from "@aonsoku/capacitor-native/preferences";

export function isNativePreferencesAvailable(): boolean {
  const platform = Capacitor.getPlatform();

  return (
    Capacitor.isNativePlatform() &&
    (platform === "ios" || platform === "android") &&
    Capacitor.isPluginAvailable(NATIVE_PREFERENCES_PLUGIN_NAME)
  );
}

export { AonsokuNativePreferences } from "@aonsoku/capacitor-native/preferences";
export type { AonsokuNativePreferencesPlugin } from "@aonsoku/capacitor-native/preferences";
