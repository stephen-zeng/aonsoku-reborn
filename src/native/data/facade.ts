import { Capacitor } from "@capacitor/core";
import {
  AonsokuNativeData,
  NATIVE_DATA_PLUGIN_NAME,
  type AonsokuNativeDataPlugin,
} from "@aonsoku/capacitor-native/data";

export type NativeDataAvailability =
  | { available: true; plugin: AonsokuNativeDataPlugin }
  | { available: false; reason: string };

const NATIVE_DATA_PLATFORMS = ["ios", "android"];

export function getNativeDataAvailability(): NativeDataAvailability {
  if (
    !Capacitor.isNativePlatform() ||
    !NATIVE_DATA_PLATFORMS.includes(Capacitor.getPlatform())
  ) {
    return {
      available: false,
      reason: "Only supported in Capacitor iOS and Android",
    };
  }

  if (!Capacitor.isPluginAvailable(NATIVE_DATA_PLUGIN_NAME)) {
    return {
      available: false,
      reason: "Native data plugin is not installed",
    };
  }

  return { available: true, plugin: AonsokuNativeData };
}

export function isNativeDataAvailable(): boolean {
  return getNativeDataAvailability().available;
}

export { AonsokuNativeData } from "@aonsoku/capacitor-native/data";
export type { AonsokuNativeDataPlugin } from "@aonsoku/capacitor-native/data";
