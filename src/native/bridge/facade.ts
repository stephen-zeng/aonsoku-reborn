import { Capacitor } from "@capacitor/core";
import {
  AonsokuNativeBridge,
  NATIVE_BRIDGE_PLUGIN_NAME,
  type AonsokuNativeBridgePlugin,
} from "@aonsoku/capacitor-native/bridge";

export type NativeBridgeAvailability =
  | { available: true; plugin: AonsokuNativeBridgePlugin }
  | { available: false; reason: string };

export function getNativeBridgeAvailability(): NativeBridgeAvailability {
  if (!Capacitor.isNativePlatform()) {
    return {
      available: false,
      reason: "Only supported on native Capacitor platforms",
    };
  }

  const platform = Capacitor.getPlatform();
  if (platform !== "ios" && platform !== "android") {
    return {
      available: false,
      reason: `Unsupported native platform: ${platform}`,
    };
  }

  if (!Capacitor.isPluginAvailable(NATIVE_BRIDGE_PLUGIN_NAME)) {
    return {
      available: false,
      reason: "Native bridge plugin is not installed",
    };
  }

  return { available: true, plugin: AonsokuNativeBridge };
}

export function isNativeBridgeAvailable(): boolean {
  return getNativeBridgeAvailability().available;
}

export { AonsokuNativeBridge } from "@aonsoku/capacitor-native/bridge";
export type {
  AonsokuNativeBridgePlugin,
  LoginOptions,
  LoginResult,
  StoredCredentials,
} from "@aonsoku/capacitor-native/bridge";
