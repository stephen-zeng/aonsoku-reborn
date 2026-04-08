// Aonsoku Service Worker
// Build hash & precache manifest are injected by the Vite plugin during builds
const CACHE_VERSION = "__BUILD_HASH__";
const CACHE_PREFIX = "aonsoku-";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

// Precache manifest — replaced at build time by the Vite plugin.
// Quoted string keeps the file valid JS if the replacement ever fails.
const PRECACHE_URLS = "__PRECACHE_MANIFEST__";

// Patterns that must never be cached (API, streaming)
const NO_CACHE_PATTERNS = [
  /\/rest\//,
  /\/api\//,
  /\/stream/,
  /\/getCoverArt/,
  /\/getAvatar/,
  /chrome-extension:\/\//,
];

// Prevents noisy console errors for non-critical config scripts when offline
const OFFLINE_FALLBACK_PATTERNS = [/\/env-config\.js/];

// Vite hashed assets: filename contains 8+ hex chars before extension
const HASHED_ASSET_RE = /[-.][0-9a-f]{8,}\.(js|css)(\?.*)?$/;

// Static assets that rarely change (fonts, images, icons)
const STATIC_ASSET_RE =
  /\.(woff2?|ttf|otf|eot|png|jpg|jpeg|svg|gif|ico|webp|webmanifest|xml)(\?.*)?$/;

// Ignore query-string differences when matching cached entries
const CACHE_MATCH_OPTS = { ignoreSearch: true };

// ── Install ──────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // Use individual cache.add() with allSettled so a single
        // failing URL (e.g. slow connection) doesn't abort the
        // entire precache — the app shell and critical chunks
        // still get cached.
        if (!Array.isArray(PRECACHE_URLS)) {
          console.error(
            "[SW] Precache manifest was not injected at build time",
          );
          return;
        }
        return Promise.allSettled(
          PRECACHE_URLS.map((url) => cache.add(url)),
        ).then((results) => {
          const failed = results.filter((r) => r.status === "rejected");
          if (failed.length) {
            console.warn(
              `[SW] Precache: ${PRECACHE_URLS.length - failed.length}/${PRECACHE_URLS.length} OK, ${failed.length} failed`,
              failed.map((r) => r.reason),
            );
          }
        });
      })
      .then(() => self.skipWaiting()),
  );
});

// ── Activate ─────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => {
              console.log("[SW] Deleting old cache:", key);
              return caches.delete(key);
            }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Cross-origin requests use opaque responses that can't be inspected;
  // let the browser handle them natively.
  if (!request.url.startsWith(self.location.origin + "/")) return;

  // Skip requests that should never be cached
  if (NO_CACHE_PATTERNS.some((re) => re.test(request.url))) return;

  // Requests that should return an empty fallback when offline
  // (e.g. env-config.js — optional runtime config, not critical)
  if (OFFLINE_FALLBACK_PATTERNS.some((re) => re.test(request.url))) {
    event.respondWith(networkWithEmptyFallback(request));
    return;
  }

  // Navigation requests: network-first with SPA fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (hashed JS/CSS, fonts, images): cache-first
  if (HASHED_ASSET_RE.test(request.url) || STATIC_ASSET_RE.test(request.url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ── Strategies ───────────────────────────────────────────────

async function networkFirst(request) {
  try {
    const response = await fetch(safeFetchRequest(request));
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // SPA fallback: serve the cached app shell for any navigation.
    // This covers the case where the user navigates to "/" but the
    // precache stored the response under "/index.html".
    const shell = await caches.match("/index.html");
    if (shell && isValidResponse(shell)) return shell;

    return createOfflineResponse();
  }
}

async function cacheFirst(request) {
  try {
    const cached = await caches.match(request, CACHE_MATCH_OPTS);
    if (cached && isValidResponse(cached)) return cached;

    const cache = await caches.open(CACHE_NAME);
    if (cached) await cache.delete(request);

    const response = await fetch(safeFetchRequest(request));
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return createOfflineResponse();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, CACHE_MATCH_OPTS);

  // Clone the request without browser-imposed cache constraints
  // to avoid net::ERR_CACHE_MISS when the browser sends
  // requests with cache: "only-if-cached" (e.g. bfcache, prefetch)
  const networkPromise = fetch(safeFetchRequest(request))
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached && isValidResponse(cached)) return cached;

  const response = await networkPromise;
  if (response) return response;

  return createOfflineResponse();
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Network-first but returns an empty JS response on failure instead
 * of letting the browser's default fetch produce ERR_INTERNET_DISCONNECTED.
 * Used for optional scripts like env-config.js.
 */
async function networkWithEmptyFallback(request) {
  try {
    return await fetch(safeFetchRequest(request));
  } catch {
    return new Response("// offline", {
      status: 200,
      headers: { "Content-Type": "application/javascript" },
    });
  }
}

/**
 * Create a fetch-safe copy of a request: strips browser-imposed
 * cache constraints (cache: "only-if-cached") and downgrades
 * "navigate" mode to "same-origin" (fetch() can't use "navigate").
 */
function safeFetchRequest(request) {
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    mode: request.mode === "navigate" ? "same-origin" : request.mode,
    credentials: request.credentials,
    redirect: request.redirect,
  });
}

function isValidResponse(response) {
  // Defensive: opaque responses (cross-origin no-cors) can't be inspected,
  // but treat them as valid if they somehow reach the cache.
  if (response.type === "opaque") return true;
  return response && response.status >= 200 && response.status < 400;
}

function createOfflineResponse() {
  return new Response("Offline", {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/plain" },
  });
}
