import {
  ComponentPropsWithoutRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { cacheManager } from "@/service/cache";
import { useIsCoverCached } from "@/store/cache-index.store";
import { useIsOfflineMode } from "@/store/cache.store";
import { CoverArt } from "@/types/coverArtType";
import {
  getDefaultArtUrl,
  resolveCacheKeys,
  useCoverArtUrlFromSongPreference,
} from "@/utils/coverArt";

type LazyLoadImageProps = ComponentPropsWithoutRef<typeof LazyLoadImage>;

interface UseCoverArtCacheLookupOptions {
  coverArtId?: string;
  coverArtType?: CoverArt;
  albumId?: string;
  cacheArtSize?: string;
  autoCache?: boolean;
}

function useCoverArtCacheLookup({
  coverArtId,
  coverArtType,
  albumId,
  cacheArtSize = "700",
  autoCache = true,
}: UseCoverArtCacheLookupOptions) {
  const cacheKeys = useMemo(
    () => resolveCacheKeys(coverArtId, coverArtType, albumId),
    [coverArtId, coverArtType, albumId],
  );
  const primaryCacheKey = cacheKeys[0];
  const isOffline = useIsOfflineMode();
  const isPrimaryCached = useIsCoverCached(primaryCacheKey ?? "__none__");
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  const pendingAutoCache = useRef<string | null>(null);
  const prevObjectUrl = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — reset on primaryCacheKey change
  useEffect(() => {
    pendingAutoCache.current = null;
  }, [primaryCacheKey]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: isPrimaryCached triggers re-run when auto-cache completes; primaryCacheKey derives from cacheKeys
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
        } catch (err) {
          console.warn(`[useCoverArtCacheLookup] cache error: key=${key}`, err);
        }
      }

      if (!cancelled) {
        setCachedUrl(null);
        if (
          autoCache &&
          !isOffline &&
          primaryCacheKey &&
          pendingAutoCache.current !== primaryCacheKey
        ) {
          pendingAutoCache.current = primaryCacheKey;
          cacheManager
            .cacheCover(primaryCacheKey, cacheArtSize)
            .catch((err) => {
              console.warn(
                `[useCoverArtCacheLookup] auto-cache failed: ${primaryCacheKey}`,
                err,
              );
            });
        }
      }
    }

    loadCache();

    return () => {
      cancelled = true;
      if (objectUrl) {
        if (prevObjectUrl.current && prevObjectUrl.current !== objectUrl) {
          URL.revokeObjectURL(prevObjectUrl.current);
        }
        prevObjectUrl.current = objectUrl;
      }
    };
  }, [
    cacheKeys,
    isOffline,
    isPrimaryCached,
    primaryCacheKey,
    cacheArtSize,
    autoCache,
  ]);

  useEffect(() => {
    return () => {
      if (prevObjectUrl.current) {
        URL.revokeObjectURL(prevObjectUrl.current);
      }
    };
  }, []);

  return { cachedUrl, isOffline };
}

export function useCachedCoverUrl(
  coverArtId: string | undefined,
  coverArtType: CoverArt | undefined,
  albumId: string | undefined,
  fallbackUrl: string,
  cacheArtSize = "700",
): string {
  const { cachedUrl, isOffline } = useCoverArtCacheLookup({
    coverArtId,
    coverArtType,
    albumId,
    cacheArtSize,
  });

  if (cachedUrl) return cachedUrl;
  if (isOffline) return getDefaultArtUrl(coverArtType);
  return fallbackUrl;
}

interface CachedImageProps extends Omit<LazyLoadImageProps, "src"> {
  coverArtId?: string;
  coverArtType?: CoverArt;
  coverArtSize?: string;
  cacheArtSize?: string;
  albumId?: string;
  src?: string;
  autoCache?: boolean;
}

export function CachedImage({
  coverArtId,
  coverArtType = "album",
  coverArtSize = "300",
  cacheArtSize = "700",
  albumId,
  src: directSrc,
  autoCache = true,
  onError,
  ...props
}: CachedImageProps) {
  const generatedSrc = useCoverArtUrlFromSongPreference({
    coverArt: coverArtId,
    coverArtType,
    albumId,
    size: coverArtSize,
  });
  const { cachedUrl: cachedSrc, isOffline } = useCoverArtCacheLookup({
    coverArtId,
    coverArtType,
    albumId,
    cacheArtSize,
    autoCache,
  });
  const [failedNetworkSrc, setFailedNetworkSrc] = useState<string | null>(null);

  const cacheKeys = useMemo(
    () => resolveCacheKeys(coverArtId, coverArtType, albumId),
    [coverArtId, coverArtType, albumId],
  );
  const primaryCacheKey = cacheKeys[0];

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — reset on primaryCacheKey change
  useEffect(() => {
    setFailedNetworkSrc(null);
  }, [primaryCacheKey]);

  const defaultArtUrl = getDefaultArtUrl(coverArtType);

  let resolvedSrc = cachedSrc ?? directSrc ?? generatedSrc;

  if (isOffline || resolvedSrc === failedNetworkSrc) {
    resolvedSrc = defaultArtUrl;
  }

  const handleError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const currentSrc = resolvedSrc;
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

  if (cachedSrc) {
    return (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div
        className={
          (props as Record<string, unknown>).wrapperClassName as
            | string
            | undefined
        }
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
