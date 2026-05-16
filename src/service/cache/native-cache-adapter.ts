import { getRuntime } from "@/utils/capabilities";
import type { NativeCacheAdapter, NativeCachedAudioFile } from "./contracts";

class WebNullNativeCacheAdapter implements NativeCacheAdapter {
  async storeAudioFile(
    _songId: string,
    _data: Blob,
    _contentType: string,
  ): Promise<NativeCachedAudioFile> {
    throw new Error("NativeCacheAdapter is not available on web platform");
  }

  async resolveAudioFile(_songId: string): Promise<NativeCachedAudioFile | null> {
    return null;
  }

  async getAudioFileSize(_songId: string): Promise<number | null> {
    return null;
  }

  async deleteAudioFile(_songId: string): Promise<boolean> {
    return false;
  }

  async evictAudioFile(_songId: string): Promise<boolean> {
    return false;
  }
}

let nativeCacheAdapter: NativeCacheAdapter | null = null;

export function getNativeCacheAdapter(): NativeCacheAdapter {
  if (nativeCacheAdapter) return nativeCacheAdapter;

  const runtime = getRuntime();
  if (runtime === "capacitor-ios") {
    throw new Error(
      "Capacitor iOS native cache adapter has not been implemented yet. " +
        "Install the native plugin in Phase 4.",
    );
  }
  if (runtime === "capacitor-android") {
    throw new Error(
      "Capacitor Android native cache adapter is not available until Phase 5.",
    );
  }

  nativeCacheAdapter = new WebNullNativeCacheAdapter();
  return nativeCacheAdapter;
}

export function _resetNativeCacheAdapter(): void {
  nativeCacheAdapter = null;
}

export function _setNativeCacheAdapterForTests(
  adapter: NativeCacheAdapter | null,
): void {
  nativeCacheAdapter = adapter;
}