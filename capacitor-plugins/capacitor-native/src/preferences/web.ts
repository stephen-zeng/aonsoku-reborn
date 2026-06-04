import { WebPlugin } from "@capacitor/core";
import type { AonsokuNativePreferencesPlugin } from "./definitions";
import { NATIVE_PREFERENCES_PLUGIN_NAME } from "./definitions";

function unavailable(method: string) {
  return new Error(
    `${NATIVE_PREFERENCES_PLUGIN_NAME}.${method} is only available on native Capacitor platforms.`,
  );
}

export class AonsokuNativePreferencesWeb
  extends WebPlugin
  implements AonsokuNativePreferencesPlugin
{
  getAllPreferences(): Promise<{ preferences: Record<string, string> }> {
    return Promise.reject(unavailable("getAllPreferences"));
  }
  setPreferences(_options: {
    preferences: Record<string, string>;
  }): Promise<void> {
    return Promise.reject(unavailable("setPreferences"));
  }
  setPreference(_options: { key: string; value: string }): Promise<void> {
    return Promise.reject(unavailable("setPreference"));
  }
  deletePreference(_options: { key: string }): Promise<void> {
    return Promise.reject(unavailable("deletePreference"));
  }
  getQueueState(): Promise<{ state: string | null }> {
    return Promise.reject(unavailable("getQueueState"));
  }
  setQueueState(_options: { state: string }): Promise<void> {
    return Promise.reject(unavailable("setQueueState"));
  }
  getPlayHistory(_options?: {
    limit?: number;
  }): Promise<{ history: string[] }> {
    return Promise.reject(unavailable("getPlayHistory"));
  }
  addToPlayHistory(_options: {
    song: string;
    maxSize?: number;
  }): Promise<void> {
    return Promise.reject(unavailable("addToPlayHistory"));
  }
  clearPlayHistory(): Promise<void> {
    return Promise.reject(unavailable("clearPlayHistory"));
  }
}
