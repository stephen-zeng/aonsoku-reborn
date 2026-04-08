// Aonsoku Service Worker
// Build hash is injected by the Vite plugin during production builds
const CACHE_VERSION = "__BUILD_HASH__";
const CACHE_PREFIX = "aonsoku-";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

// URL to precache during installation (app shell)
const PRECACHE_URLS = ["/index.html"];

// Patterns that must never be cached (API, streaming, runtime config)
const NO_CACHE_PATTERNS = [
  /\/rest\//,
  /\/api\//,
  /\/stream/,
  /\/getCoverArt/,
  /\/getAvatar/,
  /chrome-extension:\/\//,
  /\/env-config\.js/,
];

// Vite hashed assets: filename contains 8+ hex chars before extension
const HASHED_ASSET_RE = /[-.][0-9a-f]{8,}\.(js|css)(\?.*)?$/;

// Static assets that rarely change (fonts, images, icons)
const STATIC_ASSET_RE =
  /\.(woff2?|ttf|otf|eot|png|jpg|jpeg|svg|gif|ico|webp)(\?.*)?$/;

// ── Install ──────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(PRECACHE_URLS).catch((err) => {
          // Don't block installation if precaching fails;
          // the fetch handler will cache assets on demand.
          console.warn("[SW] Precache failed, continuing:", err);
        }),
      )
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

  // Skip requests that should never be cached
  if (NO_CACHE_PATTERNS.some((re) => re.test(request.url))) return;

  // Navigation requests: network-first with cache fallback
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
    const cached = await caches.match(request);
    if (cached && isValidResponse(cached)) return cached;
    return createOfflineResponse();
  }
}

async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
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
  const cached = await cache.match(request);

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
 * Create a fetch-safe copy of a request, stripping browser-imposed
 * cache constraints (e.g. cache: "only-if-cached") that cause
 * net::ERR_CACHE_MISS inside service workers.
 */
function safeFetchRequest(request) {
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    mode: "same-origin",
    credentials: request.credentials,
    redirect: request.redirect,
  });
}

function isValidResponse(response) {
  return response && response.status >= 200 && response.status < 400;
}

function createOfflineResponse() {
  return new Response("Offline", {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/plain" },
  });
}
