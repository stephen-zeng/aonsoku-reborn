import { toast } from "react-toastify";
import i18n from "@/i18n";
import { isDesktop } from "./desktop";

const STANDARD_PORTS = new Set(["", "80", "443"]);

// Must match CACHE_PREFIX in public/sw.js (separate JS contexts)
const CACHE_PREFIX = "aonsoku-";

export function registerServiceWorker() {
  if (!shouldRegisterServiceWorker()) return;

  setupChunkErrorRecovery();
  setupUpdateListener();
  register();
}

function shouldRegisterServiceWorker(): boolean {
  if (isDesktop()) return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!import.meta.env.PROD) return false;

  return STANDARD_PORTS.has(window.location.port);
}

// Channel name must match public/sw.js message handler.
function setupUpdateListener() {
  const broadcast = new BroadcastChannel("updateFinish");
  broadcast.addEventListener("message", (event) => {
    if (event.data?.type === "UPDATED") {
      console.log("[SW] Cache rebuild complete, reloading...");
      broadcast.close();
      window.location.reload();
    }
  });
}

function notifyUpdateReady() {
  console.log("[SW] Update installed and waiting for activation");
  toast.info(i18n.t("update.sw.newVersion"), {
    autoClose: false,
    toastId: "sw-update",
    onClick: () => window.location.reload(),
  });
}

async function register() {
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    if (registration.waiting && navigator.serviceWorker.controller) {
      notifyUpdateReady();
    }

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        switch (newWorker.state) {
          case "installed":
            if (navigator.serviceWorker.controller) {
              notifyUpdateReady();
            } else {
              console.log("[SW] Content cached for offline use");
            }
            break;
          case "activated":
            console.log("[SW] New service worker activated");
            break;
          case "redundant":
            console.warn("[SW] Service worker became redundant");
            break;
        }
      });
    });
  } catch (error) {
    console.error("[SW] Registration failed:", error);
  }
}

/**
 * Detects chunk load failures caused by stale SW cache (e.g. HTML
 * references hashed assets that no longer exist) and recovers by
 * clearing all caches and reloading.
 *
 * A sessionStorage-based cooldown prevents infinite reload loops
 * when offline (navigator.onLine alone is unreliable on captive
 * portals and flaky mobile connections).
 */
function setupChunkErrorRecovery() {
  const COOLDOWN_KEY = "sw-recovery-ts";
  const COOLDOWN_MS = 10_000;

  function recover() {
    const lastAttempt = Number(sessionStorage.getItem(COOLDOWN_KEY) || 0);
    if (Date.now() - lastAttempt < COOLDOWN_MS) {
      console.warn(
        "[SW] Chunk load failure, but recovery cooldown active — skipping",
      );
      return;
    }

    sessionStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    console.warn("[SW] Chunk load failure detected, clearing caches...");

    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => {
        window.location.reload();
      })
      .catch(() => {
        window.location.reload();
      });
  }

  function isChunkError(message: string): boolean {
    return (
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("Importing a module script failed") ||
      message.includes("error resolving module specifier") ||
      message.includes("Loading chunk") ||
      message.includes("Loading CSS chunk") ||
      message.includes("ChunkLoadError")
    );
  }

  window.addEventListener("error", (event) => {
    if (event.message && isChunkError(event.message)) {
      recover();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (reason instanceof Error && isChunkError(reason.message)) {
      recover();
    }
  });
}
