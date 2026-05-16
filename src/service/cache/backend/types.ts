export interface CacheBackend {
  put(key: string, data: Blob, contentType: string): Promise<void>;
  get(key: string): Promise<Blob | null>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}
