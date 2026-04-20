import { ComponentPropsWithoutRef, useEffect, useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { cacheManager } from "@/service/cache";
import { useIsOfflineMode } from "@/store/cache.store";
import { CoverArt } from "@/types/coverArtType";
import {
  getSongCoverArtId,
  useCoverArtUrlFromSongPreference,
} from "@/utils/coverArt";

type LazyLoadImageProps = ComponentPropsWithoutRef<typeof LazyLoadImage>;

interface CachedImageProps extends Omit<LazyLoadImageProps, "src"> {
  coverArtId?: string;
  coverArtType?: CoverArt;
  albumId?: string;
  src?: string;
}

function resolveCacheKey(
  coverArtId: string | undefined,
  coverArtType: CoverArt | undefined,
  albumId: string | undefined,
): string | undefined {
  if (!coverArtId) return undefined;
  if (coverArtType === "song" && albumId) {
    return getSongCoverArtId({ albumId, coverArt: coverArtId });
  }
  return coverArtId;
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
 * When offline and no cache hit is found, falls back to the local default
 * placeholder instead of a network URL that would fail to load.
 */
export function CachedImage({
  coverArtId,
  coverArtType = "album",
  albumId,
  src: directSrc,
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

  const cacheKey = resolveCacheKey(coverArtId, coverArtType, albumId);

  useEffect(() => {
    if (!cacheKey) {
      setCachedSrc(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    cacheManager
      .getCachedCoverUrl(cacheKey)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setCachedSrc(url);
      })
      .catch(() => {
        if (!cancelled) setCachedSrc(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [cacheKey]);

  const resolvedSrc = cachedSrc
    ?? (isOffline ? getDefaultArtUrl(coverArtType) : null)
    ?? directSrc
    ?? generatedSrc;

  return <LazyLoadImage {...props} src={resolvedSrc} />;
}
