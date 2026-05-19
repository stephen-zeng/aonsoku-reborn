import { Capacitor } from "@capacitor/core";
import {
  AonsokuNativePreferences,
  NATIVE_PREFERENCES_PLUGIN_NAME,
  type AonsokuNativePreferencesPlugin,
} from "@aonsoku/capacitor-native/preferences";

export function isNativePreferencesAvailable(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "ios" &&
    Capacitor.isPluginAvailable(NATIVE_PREFERENCES_PLUGIN_NAME)
  );
}

export function getNativePreferencesPlugin(): AonsokuNativePreferencesPlugin | null {
  if (!isNativePreferencesAvailable()) return null;
  return AonsokuNativePreferences;
}

export { AonsokuNativePreferences } from "@aonsoku/capacitor-native/preferences";
export type { AonsokuNativePreferencesPlugin } from "@aonsoku/capacitor-native/preferences";
