// Aonsoku Service Worker
// Build hash & precache manifest are injected by the Vite plugin during builds
const CACHE_VERSION = "__SW_CACHE_HASH__";
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

// Max concurrent fetches during precaching (avoids overwhelming constrained connections)
const PRECACHE_BATCH_SIZE = 15;

// ── Install ──────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell());
});

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);

  try {
    if (!Array.isArray(PRECACHE_URLS)) {
      throw new Error("Precache manifest was not injected at build time");
    }

    if (!PRECACHE_URLS.includes("/index.html")) {
      throw new Error("Precache manifest is missing /index.html");
    }

    // Cache the SPA shell first — it's the most critical resource.
    await cache.add("/index.html");

    // Batch the remaining URLs to avoid overwhelming constrained connections
    // with 190+ simultaneous fetches.
    const remaining = PRECACHE_URLS.filter((u) => u !== "/index.html");
    const failedUrls = [];

    for (let i = 0; i < remaining.length; i += PRECACHE_BATCH_SIZE) {
      const batch = remaining.slice(i, i + PRECACHE_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((url) => cache.add(url)),
      );

      for (const [index, result] of results.entries()) {
        if (result.status === "rejected") {
          failedUrls.push(batch[index]);
        }
      }
    }

    if (failedUrls.length > 0) {
      console.error("[SW] Precache failed for URLs:", failedUrls);
      throw new Error(`Precache failed for ${failedUrls.length} URLs`);
    }
  } catch (error) {
    console.error("[SW] Install failed, keeping previous cache:", error);
    throw error;
  }
}

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

  // Hashed assets (content-addressed JS/CSS): cache-first — immutable
  if (HASHED_ASSET_RE.test(request.url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Non-hashed static assets (fonts, images, icons): stale-while-revalidate
  // — these may change without a URL change, so always revalidate in background.
  if (STATIC_ASSET_RE.test(request.url)) {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  // Everything else: stale-while-revalidate.
  // Pass event so the strategy can extend SW lifetime for the background write.
  event.respondWith(staleWhileRevalidate(request, event));
});

// ── Strategies ───────────────────────────────────────────────

async function networkFirst(request) {
  try {
    const response = await fetch(safeFetchRequest(request));
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      // Await the write so the SW doesn't terminate before it completes,
      // which would produce a cache entry with an empty (0-byte) body.
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    // SPA fallback: serve the cached app shell for any navigation.
    // Parallel lookup covers the case where the user navigates to a
    // sub-route (e.g. "/settings") that was cached under its own URL
    // but also has /index.html as the canonical shell.
    const [shell, cachedNav] = await Promise.all([
      caches.match("/index.html", CACHE_MATCH_OPTS),
      caches.match(request, CACHE_MATCH_OPTS),
    ]);
    if (shell && isValidResponse(shell)) return shell;
    if (cachedNav && isValidResponse(cachedNav)) return cachedNav;

    return createOfflineResponse();
  }
}

async function cacheFirst(request) {
  try {
    const cached = await caches.match(request, CACHE_MATCH_OPTS);
    if (cached && isValidResponse(cached)) return cached;

    const cache = await caches.open(CACHE_NAME);
    // cache.put() overwrites existing entries, so no explicit delete needed.

    const response = await fetch(safeFetchRequest(request));
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return createOfflineResponse();
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, CACHE_MATCH_OPTS);

  const networkPromise = fetch(safeFetchRequest(request))
    .then(async (response) => {
      if (response.ok) {
        // Await inside async .then() so the promise doesn't settle
        // until the cache write is fully committed.
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached && isValidResponse(cached)) {
    // Keep the SW alive until the background network+cache update
    // finishes — without this, the SW may terminate mid-write and
    // produce another 0-byte cache entry.
    event.waitUntil(networkPromise);
    return cached;
  }

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
  if (!response) return false;
  // Opaque responses (cross-origin no-cors) can't be inspected;
  // treat them as valid if they somehow reach the cache.
  if (response.type === "opaque") return true;
  if (response.status < 200 || response.status >= 400) return false;
  // Reject entries with an explicitly empty body — these are corrupted
  // cache writes that were interrupted before the SW could finish.
  const cl = response.headers.get("content-length");
  if (cl === "0") return false;
  return true;
}

function createOfflineResponse() {
  return new Response("Offline", {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/plain" },
  });
}
