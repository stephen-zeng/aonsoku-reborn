import { ComponentPropsWithoutRef, useEffect, useMemo, useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { cacheManager } from "@/service/cache";
import { useIsOfflineMode } from "@/store/cache.store";
import { CoverArt } from "@/types/coverArtType";
import {
  resolveCacheKeys,
  useCoverArtUrlFromSongPreference,
} from "@/utils/coverArt";

type LazyLoadImageProps = ComponentPropsWithoutRef<typeof LazyLoadImage>;

interface CachedImageProps extends Omit<LazyLoadImageProps, "src"> {
  coverArtId?: string;
  coverArtType?: CoverArt;
  albumId?: string;
  src?: string;
}

export function useCachedCoverUrl(
  coverArtId: string | undefined,
  coverArtType: CoverArt | undefined,
  albumId: string | undefined,
  fallbackUrl: string,
): string {
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  const cacheKeys = useMemo(
    () => resolveCacheKeys(coverArtId, coverArtType, albumId),
    [coverArtId, coverArtType, albumId]
  );
  const isOffline = useIsOfflineMode();

  useEffect(() => {
    if (cacheKeys.length === 0) {
      setCachedUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadCache() {
      for (const key of cacheKeys) {
        try {
          const url = await cacheManager.getCachedCoverUrl(key);
          if (url) {
            if (cancelled) {
              URL.revokeObjectURL(url);
              return;
            }
            objectUrl = url;
            setCachedUrl(url);
            return;
          }
        } catch {
          // ignore error and try the next key
        }
      }
      if (!cancelled) setCachedUrl(null);
    }

    loadCache();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [cacheKeys]);

  if (cachedUrl) return cachedUrl;
  if (isOffline) {
    const type = coverArtType === "artist" ? "artist" : "album";
    return `/default_${type}_art.png`;
  }
  return fallbackUrl;
}

function getDefaultArtUrl(coverArtType: CoverArt): string {
  const type = coverArtType === "artist" ? "artist" : "album";
  return `/default_${type}_art.png`;
}

/**
 * Drop-in replacement for LazyLoadImage that resolves cover art URLs.
 *
 * Use with coverArtId/coverArtType/coverArtSize for automatic URL resolution,
 * or pass a plain `src` to behave like a normal image.
 *
 * When offline (or when the Navidrome server is unreachable) and no cache hit
 * is found, falls back to the local default placeholder instead of a network
 * URL that would fail to load.
 */
export function CachedImage({
  coverArtId,
  coverArtType = "album",
  albumId,
  src: directSrc,
  onError,
  ...props
}: CachedImageProps) {
  const generatedSrc = useCoverArtUrlFromSongPreference({
    coverArt: coverArtId,
    coverArtType,
    albumId,
    size: "300",
  });
  const isOffline = useIsOfflineMode();
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);
  const [failedNetworkSrc, setFailedNetworkSrc] = useState<string | null>(null);

  const cacheKeys = useMemo(
    () => resolveCacheKeys(coverArtId, coverArtType, albumId),
    [coverArtId, coverArtType, albumId]
  );
  const primaryCacheKey = cacheKeys[0];

  // Reset failure state when the underlying song/album changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — reset on primary cacheKey change
  useEffect(() => {
    setFailedNetworkSrc(null);
  }, [primaryCacheKey]);

  useEffect(() => {
    if (cacheKeys.length === 0) {
      console.debug(
        `[CachedImage] no cacheKey (coverArtId=${coverArtId}, type=${coverArtType}, albumId=${albumId})`,
      );
      setCachedSrc(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadCache() {
      for (const key of cacheKeys) {
        try {
          const url = await cacheManager.getCachedCoverUrl(key);
          if (url) {
            if (cancelled) {
              URL.revokeObjectURL(url);
              return;
            }
            objectUrl = url;
            console.debug(
              `[CachedImage] cache HIT: key=${key}, coverArtId=${coverArtId}, type=${coverArtType}, albumId=${albumId}`,
            );
            setCachedSrc(url);
            return;
          }
        } catch (err) {
          console.warn(`[CachedImage] cache error: key=${key}`, err);
        }
      }
      
      console.debug(
        `[CachedImage] cache MISS: keys=${cacheKeys.join(",")}, coverArtId=${coverArtId}, type=${coverArtType}, albumId=${albumId}`,
      );
      if (!cancelled) setCachedSrc(null);
    }

    loadCache();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [cacheKeys, coverArtId, coverArtType, albumId]);

  const defaultArtUrl = getDefaultArtUrl(coverArtType);

  // Build the src resolution chain:
  // 1. Cached blob (always preferred, works offline & online)
  // 2. If offline OR the current network src has already failed -> default art
  // 3. Explicit direct src
  // 4. Generated network src (Subsonic getCoverArt)
  let resolvedSrc = cachedSrc ?? directSrc ?? generatedSrc;

  // When we know the network is unavailable, skip the network src entirely.
  if (isOffline || resolvedSrc === failedNetworkSrc) {
    resolvedSrc = defaultArtUrl;
  }

  const handleError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const currentSrc = resolvedSrc;
    // If the currently resolved src is a network URL and we haven't already
    // failed on it, mark it as failed so the next render falls back.
    if (
      currentSrc &&
      currentSrc !== defaultArtUrl &&
      currentSrc !== failedNetworkSrc &&
      currentSrc !== cachedSrc
    ) {
      setFailedNetworkSrc(currentSrc);
    }
    onError?.(e as never);
  };

  // When a cached blob is available, bypass LazyLoadImage entirely.
  // LazyLoadImage's effect/opacity state machine can get stuck when src
  // switches from a network URL to a blob URL (especially in Electron),
  // leaving the image permanently invisible.  A plain <img> with forced
  // opacity always renders the blob correctly, and since the data is
  // local we don't need lazy loading anyway.
  if (cachedSrc) {
    return (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div
        className={(props as Record<string, unknown>).wrapperClassName as string | undefined}
        style={props.style}
        onClick={props.onClick}
      >
        <img
          alt={props.alt}
          className={props.className}
          crossOrigin={props.crossOrigin}
          data-testid={props["data-testid"]}
          height={props.height}
          id={props.id}
          loading={props.loading}
          onError={handleError}
          onLoad={props.onLoad}
          src={cachedSrc}
          style={{ opacity: 1 }}
          title={props.title}
          width={props.width}
        />
      </div>
    );
  }

  return <LazyLoadImage {...props} src={resolvedSrc} onError={handleError} />;
}
