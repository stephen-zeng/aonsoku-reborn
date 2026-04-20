import { ComponentPropsWithoutRef, useEffect, useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { cacheManager } from "@/service/cache";
import { CoverArt } from "@/types/coverArtType";
import {
  getSongCoverArtId,
  useCoverArtUrlFromSongPreference,
} from "@/utils/coverArt";

type LazyLoadImageProps = ComponentPropsWithoutRef<typeof LazyLoadImage>;

interface CachedImageProps extends Omit<LazyLoadImageProps, "src"> {
  coverArtId?: string;
  coverArtType?: CoverArt;
  coverArtSize?: string;
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

/**
 * Drop-in replacement for LazyLoadImage that resolves cover art URLs.
 *
 * Use with coverArtId/coverArtType/coverArtSize for automatic URL resolution,
 * or pass a plain `src` to behave like a normal image.
 */
export function CachedImage({
  coverArtId,
  coverArtType = "album",
  coverArtSize = "300",
  albumId,
  src: directSrc,
  ...props
}: CachedImageProps) {
  const generatedSrc = useCoverArtUrlFromSongPreference({
    coverArt: coverArtId,
    coverArtType,
    albumId,
    size: coverArtSize,
  });
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
      .getCachedCoverUrl(cacheKey, coverArtSize)
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
  }, [cacheKey, coverArtSize]);

  const resolvedSrc = cachedSrc ?? directSrc ?? generatedSrc;

  return <LazyLoadImage {...props} src={resolvedSrc} />;
}
