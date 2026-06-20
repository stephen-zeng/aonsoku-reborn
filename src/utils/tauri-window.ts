import { hasTauriBridge } from "./desktop";
import { logger } from "./logger";
import { getTauriCurrentWindow, type TauriUnlistenFn } from "./tauri";

const WINDOW_STATE_EVENTS = ["tauri://resize", "tauri://scale-change"];

function getWindow() {
  if (!hasTauriBridge()) return null;
  return getTauriCurrentWindow();
}

async function callTauriWindow<T>(
  action: string,
  fallback: T,
  handler: () => Promise<T>,
) {
  try {
    return await handler();
  } catch (error) {
    logger.error(`[TauriWindow] ${action} failed`, error);
    return fallback;
  }
}

export function isTauriWindowSupported() {
  return getWindow() !== null;
}

export async function isTauriWindowFullscreen() {
  const window = getWindow();
  if (!window) return false;
  return callTauriWindow("isFullscreen", false, () => window.isFullscreen());
}

export async function isTauriWindowMaximized() {
  const window = getWindow();
  if (!window) return false;
  return callTauriWindow("isMaximized", false, () => window.isMaximized());
}

export async function setTauriWindowFullscreen(fullscreen: boolean) {
  const window = getWindow();
  if (!window) return;
  await callTauriWindow("setFullscreen", undefined, () =>
    window.setFullscreen(fullscreen),
  );
}

export async function toggleTauriWindowMaximize() {
  const window = getWindow();
  if (!window) return;
  await callTauriWindow("toggleMaximize", undefined, () =>
    window.toggleMaximize(),
  );
}

export async function minimizeTauriWindow() {
  const window = getWindow();
  if (!window) return;
  await callTauriWindow("minimize", undefined, () => window.minimize());
}

export async function closeTauriWindow() {
  const window = getWindow();
  if (!window) return;
  await callTauriWindow("close", undefined, () => window.close());
}

export async function startTauriWindowDrag() {
  const window = getWindow();
  if (!window?.startDragging) return;
  await callTauriWindow(
    "startDragging",
    undefined,
    () => window.startDragging?.() ?? Promise.resolve(),
  );
}

export async function listenTauriWindowStateChanges(handler: () => void) {
  const window = getWindow();
  if (!window?.listen) return () => {};

  const listeners = await Promise.all(
    WINDOW_STATE_EVENTS.map((event) =>
      window.listen(event, handler).catch((error) => {
        logger.error(`[TauriWindow] listen ${event} failed`, error);
        return null;
      }),
    ),
  );

  return () => {
    for (const unlisten of listeners) {
      if (typeof unlisten === "function") {
        (unlisten as TauriUnlistenFn)();
      }
    }
  };
}
