// Aonsoku Service Worker — self-maintained, no external libraries
// Cache version is injected at build time by Vite plugin
const CACHE_VERSION = "__SW_CACHE_VERSION__";
const CACHE_NAME = `aonsoku-cache-v${CACHE_VERSION}`;
const CACHE_PREFIX = "aonsoku-cache-v";
const API_CACHE_NAME = `aonsoku-api-v${CACHE_VERSION}`;

// Replaced at build time with a JSON array of asset URLs.
// In dev, stays as a string — Array.isArray() skips precaching.
const PRECACHE_MANIFEST = "__SW_PRECACHE_MANIFEST__";
const CRITICAL_URLS = ["/index.html"];

// API paths that are safe to cache with StaleWhileRevalidate
const CACHEABLE_API_PREFIXES = [
  "/rest/getGenres",
  "/rest/getArtists",
  "/rest/getAlbumList",
  "/rest/getAlbumList2",
  "/rest/getAlbum",
  "/rest/getArtist",
  "/rest/getArtistInfo",
  "/rest/getArtistInfo2",
  "/rest/getSong",
  "/rest/getPlaylist",
  "/rest/getPlaylists",
  "/rest/getMusicDirectory",
  "/rest/getIndexes",
  "/rest/getMusicFolders",
  "/rest/getTopSongs",
  "/rest/getLyrics",
  "/rest/search",
  "/rest/search2",
  "/rest/search3",
];

// Maximum age (ms) for stale-while-revalidate API responses.
// Entries older than this are served from network instead of cache.
const MAX_STALE_AGE_MS = 30 * 60 * 1000; // 30 minutes

function isApiGetRequest(request) {
  return (
    request.method === "GET" &&
    CACHEABLE_API_PREFIXES.some((prefix) =>
      new URL(request.url).pathname.startsWith(prefix),
    )
  );
}

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
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Critical resources must succeed
      await cache.addAll(CRITICAL_URLS);

      // 2. Precache build assets — batch first, individual fallback
      if (Array.isArray(PRECACHE_MANIFEST)) {
        const failed = [];

        try {
          await cache.addAll(PRECACHE_MANIFEST);
        } catch {
          // Batch failed — retry individually, collect failures
          await Promise.all(
            PRECACHE_MANIFEST.map((url) =>
              cache.add(url).catch((err) => {
                failed.push(url);
                console.warn(`[SW] Failed to precache ${url}:`, err);
              }),
            ),
          );
        }

        // JS/CSS are critical — missing chunks cause white-screen
        const criticalFailed = failed.filter(
          (url) => url.endsWith(".js") || url.endsWith(".css"),
        );
        if (criticalFailed.length > 0) {
          throw new Error(
            `[SW] Critical assets failed: ${criticalFailed.join(", ")}`,
          );
        }
      }

      // 3. Open API cache
      await caches.open(API_CACHE_NAME);
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
              (key) =>
                (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) ||
                (key.startsWith("aonsoku-api-") && key !== API_CACHE_NAME),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function cacheResponse(key, response) {
  return caches
    .open(CACHE_NAME)
    .then((cache) => cache.put(key, response))
    .catch((err) => console.warn("[SW] Cache write failed:", err));
}

// Stale-while-revalidate for API responses, with a max-stale age.
// If the cached response is older than MAX_STALE_AGE_MS, skip the cache
// and go network-first. Falls back to stale cache if network is offline.
function staleWhileRevalidate(event) {
  const { request } = event;

  event.respondWith(
    caches.open(API_CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              event.waitUntil(cache.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => undefined);

        if (cached) {
          const dateHeader = cached.headers.get("date");
          const cachedAge = dateHeader
            ? Date.now() - new Date(dateHeader).getTime()
            : Infinity;

          if (Number.isFinite(cachedAge) && cachedAge < MAX_STALE_AGE_MS) {
            // Fresh enough — serve stale, revalidate in background
            return cached;
          }
          // Stale entry is too old or Date header missing — try network first
        }

        // No cache or stale entry too old — must wait for network
        return fetchPromise.then(
          (response) =>
            response ||
            // Network failed — serve stale cache as last resort, or 503
            cached ||
            new Response("", {
              status: 503,
              statusText: "Service Unavailable",
            }),
        );
      }),
    ),
  );
}

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
            event.waitUntil(cacheResponse("/index.html", response.clone()));
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
              event.waitUntil(cacheResponse(request, response.clone()));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Cacheable API GET requests: stale-while-revalidate
  if (isApiGetRequest(request)) {
    staleWhileRevalidate(event);
    return;
  }

  // Everything else (API mutations, non-cacheable calls): network-only pass-through
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
