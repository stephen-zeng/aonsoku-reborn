"use strict";

// Build hash & precache manifest are injected by the Vite plugin during builds.
// Must match CACHE_PREFIX in src/utils/swRegistration.ts (separate JS contexts).
const CACHE_PREFIX = "aonsoku-";
const CACHE_VERSION = "__SW_CACHE_HASH__";
const MAIN_CACHE = CACHE_PREFIX + "Main-" + CACHE_VERSION;
const EXTERNAL_CACHE = CACHE_PREFIX + "ExternalRes-" + CACHE_VERSION;

// Precache manifest — replaced at build time by the Vite plugin.
const PRECACHE_URLS = "__PRECACHE_MANIFEST__";

// Max concurrent fetches during precaching.
const PRECACHE_BATCH_SIZE = 15;

const EXTERNAL_CACHE_MAX_ENTRIES = 60;

const MATCH_OPTS = { ignoreSearch: true, ignoreVary: true };

// Cache self origin once — it never changes.
const SELF_URL = new URL(self.location.href);

// ── Caching Strategies ──────────────────────────────────────

// Opaque responses have an unknown status and caching them risks permanently
// serving a silent error response to the client.
function cacheFirst(request, key) {
  return caches.open(key).then(function (cache) {
    return cache.match(request, MATCH_OPTS).then(function (response) {
      if (response) return response;
      return fetch(request).then(function (networkResponse) {
        if (networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      });
    });
  });
}

// server returns a non-ok status (e.g. 500), so users see stale content
// instead of an error page.
function onlineFirst(request, key) {
  return caches.open(key).then(function (cache) {
    const cacheMatch = function () {
      return cache.match(request, MATCH_OPTS);
    };
    return fetch(request)
      .then(function (response) {
        if (response.ok) {
          cache.put(request, response.clone());
          return response;
        }
        // Server returned an error — try the cache before surfacing it.
        return cacheMatch().then(function (cached) {
          return cached || response;
        });
      })
      .catch(cacheMatch);
  });
}

// evicting the oldest entries (insertion order) first.
function trimExternalCache(cache) {
  return cache.keys().then(function (keys) {
    if (keys.length <= EXTERNAL_CACHE_MAX_ENTRIES) return;
    const toDelete = keys.slice(0, keys.length - EXTERNAL_CACHE_MAX_ENTRIES);
    return Promise.all(
      toDelete.map(function (req) {
        return cache.delete(req);
      })
    );
  });
}

// ── Install ─────────────────────────────────────────────────

// activate before precaching has fully completed.
self.addEventListener("install", function (e) {
  e.waitUntil(
    precacheAppShell().then(function () {
      return self.skipWaiting();
    })
  );
});

function precacheAppShell() {
  // was skipped so the failure is immediately visible during development.
  if (!Array.isArray(PRECACHE_URLS)) {
    const msg = "[SW] FATAL: Precache manifest was not injected at build time";
    console.error(msg);
    // Throwing rejects the install promise, causing the SW to not install,
    // which surfaces the problem clearly instead of shipping a broken PWA.
    throw new Error(msg);
  }

  return caches.open(MAIN_CACHE).then(function (cache) {
    // Cache the SPA shell first — it's the most critical resource.
    return cache.add("/index.html").then(function () {
      const remaining = PRECACHE_URLS.filter(function (u) {
        return u !== "/index.html";
      });
      const failedUrls = [];

      function processBatch(startIndex) {
        if (startIndex >= remaining.length) {
          if (failedUrls.length > 0) {
            console.error("[SW] Precache failed for URLs:", failedUrls);
          }
          return Promise.resolve();
        }

        const batch = remaining.slice(startIndex, startIndex + PRECACHE_BATCH_SIZE);
        return Promise.allSettled(
          batch.map(function (url) {
            return cache.add(url);
          })
        ).then(function (results) {
          for (let i = 0; i < results.length; i++) {
            if (results[i].status === "rejected") {
              failedUrls.push(batch[i]);
            }
          }
          return processBatch(startIndex + PRECACHE_BATCH_SIZE);
        });
      }

      return processBatch(0);
    });
  });
}

// ── Activate ────────────────────────────────────────────────

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function (name) {
              if (name === MAIN_CACHE) return false;
              if (name === EXTERNAL_CACHE) return false;
              return name.startsWith(CACHE_PREFIX);
            })
            .map(function (name) {
              console.log("[SW] Deleting old cache:", name);
              return caches.delete(name);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

// ── Fetch ───────────────────────────────────────────────────

self.addEventListener("fetch", function (e) {
  const url = new URL(e.request.url);

  if (e.request.method !== "GET" || !["http:", "https:"].includes(url.protocol)) return;

  if (
    url.pathname.endsWith("sw.js") ||
    url.hostname === "localhost" ||
    url.pathname.includes("/rest/") ||
    url.pathname.includes("/api/") ||
    url.pathname.includes("/stream")
  ) {
    return;
  }

  if (url.pathname.endsWith("env-config.js")) {
    e.respondWith(
      fetch(e.request).catch(function () {
        return new Response("// offline", {
          status: 200,
          headers: { "Content-Type": "application/javascript" },
        });
      })
    );
    return;
  }

  if (e.request.mode === "navigate") {
    e.respondWith(
      onlineFirst(e.request, MAIN_CACHE).then(function (response) {
        if (response && response.ok) return response;
        // Fall back to the cached app shell regardless of the original URL.
        return caches.open(MAIN_CACHE).then(function (cache) {
          return cache.match("/index.html", MATCH_OPTS).then(function (shell) {
            return (
              shell ||
              new Response("Offline", {
                status: 503,
                statusText: "Service Unavailable",
                headers: { "Content-Type": "text/plain" },
              })
            );
          });
        });
      })
    );
    return;
  }

  if (url.hostname === SELF_URL.hostname) {
    e.respondWith(cacheFirst(e.request, MAIN_CACHE));
    return;
  }

  e.respondWith(
    caches.open(EXTERNAL_CACHE).then(function (cache) {
      return cache.match(e.request, MATCH_OPTS).then(function (cached) {
        if (cached) return cached;
        return fetch(e.request).then(function (response) {
          if (response.ok) {
            cache.put(e.request, response.clone());
            // Trim asynchronously — do not block the response.
            trimExternalCache(cache);
          }
          return response;
        });
      });
    })
  );
});

// ── Message (cache rebuild) ─────────────────────────────────
// Channel name must match src/utils/swRegistration.ts setupUpdateListener().

self.addEventListener("message", function (event) {
  const data = event.data;
  if (!data || !data.action) return;

  if (data.action === "update") {
    const assetSet = new Set(Array.isArray(PRECACHE_URLS) ? PRECACHE_URLS : []);

    if (Array.isArray(data.assets)) {
      for (let i = 0; i < data.assets.length; i++) {
        assetSet.add("/assets/" + data.assets[i]);
      }
    }

    const assets = Array.from(assetSet);

    const TEMP_CACHE = MAIN_CACHE + "-update-tmp";

    caches
      .open(TEMP_CACHE)
      .then(function (tmpCache) {
        return tmpCache.addAll(assets);
      })
      .then(function () {
        return caches.delete(MAIN_CACHE);
      })
      .then(function () {
        return caches.open(MAIN_CACHE).then(function (newCache) {
          return caches.open(TEMP_CACHE).then(function (tmpCache) {
            return tmpCache.keys().then(function (keys) {
              return Promise.all(
                keys.map(function (req) {
                  return tmpCache.match(req).then(function (res) {
                    return newCache.put(req, res);
                  });
                })
              );
            });
          });
        });
      })
      .then(function () {
        return caches.delete(TEMP_CACHE);
      })
      .then(function () {
        const broadcast = new BroadcastChannel("updateFinish");
        broadcast.postMessage({ type: "UPDATED" });
        broadcast.close();
      })
      .catch(function (err) {
        console.error("[SW] Cache rebuild failed:", err);
        // Clean up the temp cache on failure so it does not linger.
        caches.delete(TEMP_CACHE);
      });
  }
});
