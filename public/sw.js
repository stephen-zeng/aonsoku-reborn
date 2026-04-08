"use strict";

// Build hash & precache manifest are injected by the Vite plugin during builds.
// Must match CACHE_PREFIX in src/utils/swRegistration.ts (separate JS contexts).
var CACHE_PREFIX = "aonsoku-";
var CACHE_VERSION = "__SW_CACHE_HASH__";
var MAIN_CACHE = CACHE_PREFIX + "Main-" + CACHE_VERSION;
var EXTERNAL_CACHE = CACHE_PREFIX + "ExternalRes";

// Precache manifest — replaced at build time by the Vite plugin.
var PRECACHE_URLS = "__PRECACHE_MANIFEST__";

// Max concurrent fetches during precaching.
var PRECACHE_BATCH_SIZE = 15;

var MATCH_OPTS = { ignoreSearch: true, ignoreVary: true };

// Cache self origin once — it never changes.
var SELF_URL = new URL(self.location.href);

// ── Caching Strategies ──────────────────────────────────────

function cacheFirst(request, key) {
  return caches.open(key).then(function (cache) {
    return cache.match(request, MATCH_OPTS).then(function (response) {
      return (
        response ||
        fetch(request).then(function (response) {
          if (response.ok || response.type === "opaque")
            cache.put(request, response.clone());
          return response;
        })
      );
    });
  });
}

function onlineFirst(request, key) {
  return caches.open(key).then(function (cache) {
    var offlineFetch = function () {
      return cache.match(request, MATCH_OPTS);
    };
    return fetch(request)
      .then(function (response) {
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
      .catch(offlineFetch);
  });
}

// ── Install ─────────────────────────────────────────────────

self.addEventListener("install", function (e) {
  e.waitUntil(precacheAppShell());
  self.skipWaiting();
});

function precacheAppShell() {
  return caches.open(MAIN_CACHE).then(function (cache) {
    if (!Array.isArray(PRECACHE_URLS)) {
      console.error("[SW] Precache manifest was not injected at build time");
      return Promise.resolve();
    }

    // Cache the SPA shell first — it's the most critical resource.
    var shellPromise = cache.add("/index.html");

    return shellPromise.then(function () {
      var remaining = PRECACHE_URLS.filter(function (u) {
        return u !== "/index.html";
      });
      var failedUrls = [];

      function processBatch(startIndex) {
        if (startIndex >= remaining.length) {
          if (failedUrls.length > 0) {
            console.error("[SW] Precache failed for URLs:", failedUrls);
          }
          return Promise.resolve();
        }

        var batch = remaining.slice(startIndex, startIndex + PRECACHE_BATCH_SIZE);
        return Promise.allSettled(
          batch.map(function (url) {
            return cache.add(url);
          })
        ).then(function (results) {
          for (var i = 0; i < results.length; i++) {
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
  if (e.request.method !== "GET") return;

  var url = new URL(e.request.url);

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

  // Navigation requests — online-first with SPA /index.html fallback
  if (e.request.mode === "navigate") {
    e.respondWith(
      onlineFirst(e.request, MAIN_CACHE).then(function (response) {
        if (response) return response;
        return caches.match("/index.html", MATCH_OPTS).then(function (shell) {
          return (
            shell ||
            new Response("Offline", {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "Content-Type": "text/plain" },
            })
          );
        });
      })
    );
    return;
  }

  if (url.hostname === SELF_URL.hostname) {
    e.respondWith(cacheFirst(e.request, MAIN_CACHE));
    return;
  }

  e.respondWith(cacheFirst(e.request, EXTERNAL_CACHE));
});

// ── Message (cache rebuild) ─────────────────────────────────
// Channel name must match src/utils/swRegistration.ts setupUpdateListener().

self.addEventListener("message", function (event) {
  var data = event.data;
  if (!data || !data.action) return;

  if (data.action === "update") {
    var assets = Array.isArray(PRECACHE_URLS) ? PRECACHE_URLS.slice() : [];

    if (Array.isArray(data.assets)) {
      for (var i = 0; i < data.assets.length; i++) {
        assets.push("/assets/" + data.assets[i]);
      }
    }

    caches
      .delete(MAIN_CACHE)
      .then(function () {
        return caches.open(MAIN_CACHE);
      })
      .then(function (cache) {
        return cache.addAll(assets);
      })
      .then(function () {
        var broadcast = new BroadcastChannel("updateFinish");
        broadcast.postMessage({ type: "UPDATED" });
        broadcast.close();
      })
      .catch(function (err) {
        console.error("[SW] Cache rebuild failed:", err);
      });
  }
});
