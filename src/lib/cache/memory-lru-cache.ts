/**
 * Simple LRU cache for blob URLs stored in memory.
 * Automatically revokes old blob URLs when evicting or replacing entries.
 */
export class MemoryLRUCache {
  private cache = new Map<string, string>();

  constructor(private maxEntries: number) {}

  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: string): void {
    // Revoke existing blob URL if key is being updated
    const existing = this.cache.get(key);
    if (existing?.startsWith("blob:") && existing !== value) {
      URL.revokeObjectURL(existing);
    }

    if (!this.cache.has(key) && this.cache.size >= this.maxEntries) {
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
}
