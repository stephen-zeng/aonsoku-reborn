import { hasTauriBridge } from "./desktop";
import { logger } from "./logger";

export type TauriEvent<T> = { payload: T };
export type TauriUnlistenFn = () => void;

export interface TauriWindowHandle {
  close: () => Promise<void>;
  isFullscreen: () => Promise<boolean>;
  isMaximized: () => Promise<boolean>;
  listen?: <T>(
    event: string,
    handler: (event: TauriEvent<T>) => void,
  ) => Promise<TauriUnlistenFn>;
  minimize: () => Promise<void>;
  setFullscreen: (fullscreen: boolean) => Promise<void>;
  startDragging?: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
}

interface TauriGlobalApi {
  core?: {
    invoke?: <T = unknown>(
      command: string,
      args?: Record<string, unknown>,
    ) => Promise<T>;
  };
  event?: {
    listen?: <T>(
      event: string,
      handler: (event: TauriEvent<T>) => void,
    ) => Promise<TauriUnlistenFn>;
  };
  window?: {
    getCurrentWindow?: () => TauriWindowHandle;
  };
}

let loggedMissingGlobalApi = false;

function getTauriGlobal(): TauriGlobalApi | null {
  if (!hasTauriBridge()) return null;

  const tauri = (window as { __TAURI__?: TauriGlobalApi }).__TAURI__;
  if (!tauri) {
    if (!loggedMissingGlobalApi) {
      loggedMissingGlobalApi = true;
      logger.error(
        "[Tauri] Global API unavailable. Ensure withGlobalTauri is enabled.",
      );
    }
    return null;
  }

  return tauri;
}

export function getTauriInvoke() {
  return getTauriGlobal()?.core?.invoke ?? null;
}

export function getTauriCurrentWindow() {
  return getTauriGlobal()?.window?.getCurrentWindow?.() ?? null;
}

export async function listenTauriEvent<T>(
  event: string,
  handler: (event: TauriEvent<T>) => void,
) {
  const listen = getTauriGlobal()?.event?.listen;
  if (!listen) return () => {};

  return listen<T>(event, handler);
}
