export type SwStatus = "idle" | "installing" | "waiting" | "error";

type SwStatusCallback = (status: SwStatus) => void;

let didRegister = false;
let waitingWorker: ServiceWorker | null = null;
let savedReg: ServiceWorkerRegistration | null = null;

const listeners = new Set<SwStatusCallback>();
let currentStatus: SwStatus = "idle";

function emitStatus(status: SwStatus): void {
  if (status === currentStatus) return;
  currentStatus = status;
  for (const cb of listeners) {
    cb(status);
  }
}

let shouldReloadOnControllerChange = false;
let hasReloaded = false;

/**
 * Register and manage the service worker lifecycle.
 * Only registers on hostnames ending with "aonsoku.realtvop.top".
 *
 * Each call subscribes `onStatusChange` and immediately replays the
 * current status so late callers (React StrictMode remount) don't
 * miss state.  Returns an unsubscribe function for effect cleanup.
 */
export function registerServiceWorker(
  onStatusChange: SwStatusCallback,
): () => void {
  // Always subscribe & replay, even if we already registered the SW
  listeners.add(onStatusChange);
  onStatusChange(currentStatus);

  if (!didRegister) {
    didRegister = true;
    bootstrapServiceWorker();
  }

  return () => {
    listeners.delete(onStatusChange);
  };
}

function bootstrapServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  // Allow SW registration on all deployment targets including localhost and Electron
  const isLocalhost =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname.endsWith(".localhost");
  const isFileProtocol = location.protocol === "file:";
  // Skip registration for file:// protocol (Electron without dev server)
  if (isFileProtocol) return;
  // On localhost, only register in production builds (SW precache won't work in dev)
  if (isLocalhost && import.meta.env.DEV) return;

  // Only reload when the user explicitly triggered an update
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (shouldReloadOnControllerChange && !hasReloaded) {
      hasReloaded = true;
      window.location.reload();
    }
  });

  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      savedReg = reg;
      reg.update();

      if (reg.waiting && navigator.serviceWorker.controller) {
        waitingWorker = reg.waiting;
        emitStatus("waiting");
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        if (navigator.serviceWorker.controller) {
          emitStatus("installing");
        }

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed") {
            if (navigator.serviceWorker.controller) {
              waitingWorker = newWorker;
              emitStatus("waiting");
            } else {
              emitStatus("idle");
            }
          }

          if (newWorker.state === "redundant") {
            if (navigator.serviceWorker.controller) {
              emitStatus("error");
            } else {
              emitStatus("idle");
            }
          }
        });
      });
    })
    .catch((err) => {
      console.error("[SW] Registration failed:", err);
      emitStatus("error");
    });
}

/**
 * Tell the waiting service worker to skip waiting and take over.
 * The controllerchange listener will then reload the page.
 */
export function applySwUpdate(): void {
  if (!waitingWorker) return;
  shouldReloadOnControllerChange = true;
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
}

/**
 * Retry a failed service worker update by re-checking for updates.
 * If the SW is unchanged on the server, resets status to idle.
 */
export function retrySwUpdate(): void {
  if (!savedReg) return;
  emitStatus("installing");
  savedReg
    .update()
    .then(() => {
      // If no new worker appeared, the SW is unchanged — reset
      if (!savedReg?.installing) {
        emitStatus("idle");
      }
    })
    .catch((err) => {
      console.error("[SW] Retry failed:", err);
      emitStatus("error");
    });
}
