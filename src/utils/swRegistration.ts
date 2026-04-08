import { isDesktop } from "./desktop";

const ALLOWED_HOSTS = ["aonsoku.realtvop.top", "alpha.aonsoku.realtvop.top"];

// Must match CACHE_PREFIX in public/sw.js (separate JS contexts)
const CACHE_PREFIX = "aonsoku-";

export function registerServiceWorker() {
  if (isDesktop()) return;
  if (!("serviceWorker" in navigator)) return;
  if (!ALLOWED_HOSTS.includes(window.location.hostname)) return;

  setupChunkErrorRecovery();
  register();
}

async function register() {
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        switch (newWorker.state) {
          case "installed":
            if (navigator.serviceWorker.controller) {
              console.log("[SW] Update installed, will activate on refresh");
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
 */
function setupChunkErrorRecovery() {
  let recovering = false;

  function recover() {
    if (recovering) return;
    recovering = true;

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
