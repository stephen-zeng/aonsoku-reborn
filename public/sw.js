// Aonsoku Service Worker — self-maintained, no external libraries
// Cache version is injected at build time by Vite plugin
const CACHE_VERSION = "__SW_CACHE_VERSION__";
const CACHE_NAME = `aonsoku-cache-v${CACHE_VERSION}`;
const CACHE_PREFIX = "aonsoku-cache-v";

const PRECACHE_URLS = ["/index.html"];

// Check by pathname — caller already parsed the URL
function isCacheablePathname(pathname) {
  // Hashed Vite build assets — safe to cache indefinitely
  if (pathname.startsWith("/assets/")) return true;

  if (pathname.startsWith("/favicons/")) return true;
  if (pathname.startsWith("/fonts/")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/screenshots/")) return true;

  if (
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".gif") ||
    pathname.endsWith(".ico")
  ) {
    return true;
  }

  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => {
        console.error("[SW] Precache failed, aborting install:", err);
        // Rejecting keeps this SW in "redundant" state — old SW stays active
        throw err;
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // env-config.js may be dynamically generated per deployment
  if (url.pathname === "/env-config.js") return;

  // Navigation: network-first, fallback to cached shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put("/index.html", clone);
            });
          }
          return response;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  // Static assets: cache-first
  if (isCacheablePathname(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
              });
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Everything else (API calls, etc.): network-only pass-through
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
