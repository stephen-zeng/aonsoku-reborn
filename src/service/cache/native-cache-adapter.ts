import {
  getNativeAudioPluginAvailability,
  type NativeAudioPlugin,
} from "@/native/audio";
import { getRuntime } from "@/utils/capabilities";
import { getTauriInvoke } from "@/utils/tauri";
import type { NativeCacheAdapter, NativeCachedAudioFile } from "./contracts";

type TauriInvoke = NonNullable<ReturnType<typeof getTauriInvoke>>;

interface TauriResolveAudioFileResult {
  file: NativeCachedAudioFile | null;
}

interface TauriAudioFileSizeResult {
  sizeBytes: number | null;
}

interface TauriDeleteAudioFileResult {
  deleted: boolean;
}

class WebNullNativeCacheAdapter implements NativeCacheAdapter {
  async storeAudioFile(
    _songId: string,
    _data: Blob,
    _contentType: string,
  ): Promise<NativeCachedAudioFile> {
    throw new Error("NativeCacheAdapter is not available on web platform");
  }

  async resolveAudioFile(
    _songId: string,
  ): Promise<NativeCachedAudioFile | null> {
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

  async clearAudioFiles(): Promise<void> {}
}

async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);

    if (offset % (chunkSize * 16) === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return btoa(binary);
}

export class IosNativeCacheAdapter implements NativeCacheAdapter {
  constructor(private readonly plugin: NativeAudioPlugin) {}

  async storeAudioFile(
    songId: string,
    data: Blob,
    contentType: string,
  ): Promise<NativeCachedAudioFile> {
    const dataBase64 = await arrayBufferToBase64(await data.arrayBuffer());
    return this.plugin.storeAudioFile({
      songId,
      dataBase64,
      contentType,
    });
  }

  async resolveAudioFile(
    songId: string,
  ): Promise<NativeCachedAudioFile | null> {
    const result = await this.plugin.resolveAudioFile({ songId });
    return result.file ?? null;
  }

  async getAudioFileSize(songId: string): Promise<number | null> {
    const result = await this.plugin.getAudioFileSize({ songId });
    return result.sizeBytes ?? null;
  }

  async deleteAudioFile(songId: string): Promise<boolean> {
    const result = await this.plugin.deleteAudioFile({ songId });
    return result.deleted;
  }

  async evictAudioFile(songId: string): Promise<boolean> {
    return this.deleteAudioFile(songId);
  }

  async clearAudioFiles(): Promise<void> {
    await this.plugin.clearAudioFiles();
  }
}

export class TauriNativeCacheAdapter implements NativeCacheAdapter {
  constructor(private readonly invoke: TauriInvoke) {}

  async storeAudioFile(
    songId: string,
    data: Blob,
    contentType: string,
  ): Promise<NativeCachedAudioFile> {
    const dataBase64 = await arrayBufferToBase64(await data.arrayBuffer());
    return this.invoke<NativeCachedAudioFile>(
      "desktop_cache_store_audio_file",
      {
        payload: {
          songId,
          dataBase64,
          contentType,
        },
      },
    );
  }

  async resolveAudioFile(
    songId: string,
  ): Promise<NativeCachedAudioFile | null> {
    const result = await this.invoke<TauriResolveAudioFileResult>(
      "desktop_cache_resolve_audio_file",
      { payload: { songId } },
    );
    return result.file ?? null;
  }

  async getAudioFileSize(songId: string): Promise<number | null> {
    const result = await this.invoke<TauriAudioFileSizeResult>(
      "desktop_cache_get_audio_file_size",
      { payload: { songId } },
    );
    return result.sizeBytes ?? null;
  }

  async deleteAudioFile(songId: string): Promise<boolean> {
    const result = await this.invoke<TauriDeleteAudioFileResult>(
      "desktop_cache_delete_audio_file",
      { payload: { songId } },
    );
    return result.deleted;
  }

  async evictAudioFile(songId: string): Promise<boolean> {
    return this.deleteAudioFile(songId);
  }

  async clearAudioFiles(): Promise<void> {
    await this.invoke("desktop_cache_clear_audio_files");
  }
}

let nativeCacheAdapter: NativeCacheAdapter | null = null;

export function getNativeCacheAdapter(): NativeCacheAdapter {
  const runtime = getRuntime();
  if (runtime === "tauri") {
    const invoke = getTauriInvoke();
    if (!invoke) return new WebNullNativeCacheAdapter();
    if (nativeCacheAdapter instanceof TauriNativeCacheAdapter) {
      return nativeCacheAdapter;
    }
    nativeCacheAdapter = new TauriNativeCacheAdapter(invoke);
    return nativeCacheAdapter;
  }

  if (nativeCacheAdapter) return nativeCacheAdapter;

  if (
    runtime === "capacitor-ios" ||
    runtime === "capacitor-android" ||
    runtime === "electron"
  ) {
    const availability = getNativeAudioPluginAvailability();
    if (availability.available) {
      if (!(nativeCacheAdapter instanceof IosNativeCacheAdapter)) {
        nativeCacheAdapter = new IosNativeCacheAdapter(availability.plugin);
      }
      return nativeCacheAdapter;
    }

    // Capacitor may report unavailable before plugin registration completes.
    // A cached null adapter would turn all later native cache calls into no-ops.
    return new WebNullNativeCacheAdapter();
  }

  return new WebNullNativeCacheAdapter();
}

export function isNativeCacheAdapterAvailable(): boolean {
  const runtime = getRuntime();
  if (runtime === "tauri") return getTauriInvoke() !== null;
  if (
    runtime !== "capacitor-ios" &&
    runtime !== "capacitor-android" &&
    runtime !== "electron"
  ) {
    return false;
  }

  const availability = getNativeAudioPluginAvailability();
  return availability.available;
}

export async function storeNativeAudioFileIfAvailable(
  songId: string,
  data: Blob,
  contentType: string,
): Promise<NativeCachedAudioFile | null> {
  if (!isNativeCacheAdapterAvailable()) return null;
  return getNativeCacheAdapter().storeAudioFile(songId, data, contentType);
}

export async function evictNativeAudioFileIfAvailable(
  songId: string,
): Promise<boolean> {
  if (!isNativeCacheAdapterAvailable()) return false;
  return getNativeCacheAdapter().evictAudioFile(songId);
}

export async function clearNativeAudioFilesIfAvailable(): Promise<void> {
  if (!isNativeCacheAdapterAvailable()) return;
  await getNativeCacheAdapter().clearAudioFiles();
}

export function _resetNativeCacheAdapter(): void {
  nativeCacheAdapter = null;
}

export function _setNativeCacheAdapterForTests(
  adapter: NativeCacheAdapter | null,
): void {
  nativeCacheAdapter = adapter;
}
