import type { CacheStorageAdapter } from "./contracts";

const CACHE_NAME = "aonsoku-media-cache";

class CacheStorageService implements CacheStorageAdapter {
  private async getCache(): Promise<Cache> {
    return caches.open(CACHE_NAME);
  }

  private buildUrl(key: string): string {
    return `/_cache/${encodeURIComponent(key)}`;
  }

  private buildUrlLegacy(key: string): string {
    return `/_cache/${key}`;
  }

  async put(key: string, data: Blob, contentType: string): Promise<void> {
    const cache = await this.getCache();
    const response = new Response(data, {
      headers: {
        "Content-Type": contentType,
        "X-Cached-At": Date.now().toString(),
      },
    });
    await cache.put(this.buildUrl(key), response);
  }

  async get(key: string): Promise<Blob | null> {
    const cache = await this.getCache();
    // Try the new encoded URL first, then fall back to the legacy unencoded
    // URL for backwards compatibility with existing cached entries.
    let response = await cache.match(this.buildUrl(key));
    if (!response) {
      response = await cache.match(this.buildUrlLegacy(key));
    }
    if (!response) return null;
    return response.blob();
  }

  async delete(key: string): Promise<boolean> {
    const cache = await this.getCache();
    const deleted = await cache.delete(this.buildUrl(key));
    if (deleted) return true;
    return cache.delete(this.buildUrlLegacy(key));
  }

  async has(key: string): Promise<boolean> {
    const cache = await this.getCache();
    const response = await cache.match(this.buildUrl(key));
    if (response) return true;
    const legacy = await cache.match(this.buildUrlLegacy(key));
    return legacy !== undefined;
  }

  async clear(): Promise<void> {
    await caches.delete(CACHE_NAME);
  }

  async keys(): Promise<string[]> {
    const cache = await this.getCache();
    const requests = await cache.keys();
    const prefix = "/_cache/";
    return Array.from(
      new Set(
        requests
          .map((req) => {
            const url = new URL(req.url);
            return url.pathname.startsWith(prefix)
              ? decodeURIComponent(url.pathname.slice(prefix.length))
              : url.pathname;
          })
          .filter(Boolean),
      ),
    );
  }
}

export const cacheStorage = new CacheStorageService();
