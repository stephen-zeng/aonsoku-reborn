/**
 * LRU cache for blob URLs stored in memory.
 * Automatically revokes old blob URLs when evicting or replacing entries.
 * get() promotes the accessed entry to most-recently-used.
 */
export class MemoryLRUCache {
  private cache = new Map<string, string>();

  constructor(private maxEntries: number) {}

  get(key: string): string | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Promote to most-recently-used by re-inserting at the end
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, value: string): void {
    // Revoke existing blob URL if key is being updated
    const existing = this.cache.get(key);
    if (existing?.startsWith("blob:") && existing !== value) {
      URL.revokeObjectURL(existing);
    }

    if (existing !== undefined) {
      // Already exists — delete so re-insertion moves it to end (MRU)
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict the least-recently-used (first entry in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        const oldUrl = this.cache.get(firstKey);
        if (oldUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(oldUrl);
        }
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    for (const url of this.cache.values()) {
      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    }
    this.cache.clear();
  }
}
