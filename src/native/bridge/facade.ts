import { Capacitor } from "@capacitor/core";
import {
  AonsokuNativeBridge,
  NATIVE_BRIDGE_PLUGIN_NAME,
  type AonsokuNativeBridgePlugin,
} from "@aonsoku/native-bridge";

export type NativeBridgeAvailability =
  | { available: true; plugin: AonsokuNativeBridgePlugin }
  | { available: false; reason: string };

export function getNativeBridgeAvailability(): NativeBridgeAvailability {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    return {
      available: false,
      reason: "Only supported in Capacitor iOS",
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

export { AonsokuNativeBridge } from "@aonsoku/native-bridge";
export type {
  AonsokuNativeBridgePlugin,
  LoginOptions,
  LoginResult,
  StoredCredentials,
} from "@aonsoku/native-bridge";
