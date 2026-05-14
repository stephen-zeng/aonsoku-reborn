import { useEffect, useRef, useState } from "react";
import { cacheManager } from "@/service/cache";
import { useIsOfflineMode } from "@/store/cache.store";
import { useIsAvatarCached } from "@/store/cache-index.store";

export function useAvatarUrl(username: string | undefined): string | null {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const isOffline = useIsOfflineMode();
  const isCached = useIsAvatarCached(username ?? "__none__");
  const prevObjectUrl = useRef<string | null>(null);
  const pendingAutoCache = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — reset on username change
  useEffect(() => {
    pendingAutoCache.current = null;
  }, [username]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: isCached triggers re-run when auto-cache completes; username is the primary dep
  useEffect(() => {
    if (!username) {
      setAvatarUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadAvatar() {
      try {
        const url = await cacheManager.getCachedAvatarUrl(username);
        if (url) {
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          objectUrl = url;
          setAvatarUrl(url);
          return;
        }
      } catch {
        // cache lookup failed, fall through
      }

      if (!cancelled) {
        setAvatarUrl(null);
        if (!isOffline && username && pendingAutoCache.current !== username) {
          pendingAutoCache.current = username;
          cacheManager.cacheAvatar(username).catch(() => {});
        }
      }
    }

    loadAvatar();

    return () => {
      cancelled = true;
      if (objectUrl) {
        if (prevObjectUrl.current && prevObjectUrl.current !== objectUrl) {
          URL.revokeObjectURL(prevObjectUrl.current);
        }
        prevObjectUrl.current = objectUrl;
      }
    };
  }, [username, isOffline, isCached]);

  useEffect(() => {
    return () => {
      if (prevObjectUrl.current) {
        URL.revokeObjectURL(prevObjectUrl.current);
      }
    };
  }, []);

  return avatarUrl;
}
