import { ComponentPropsWithoutRef } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { useCachedCoverArt } from "@/app/hooks/use-cached-cover-art";
import { CoverArt } from "@/types/coverArtType";

type LazyLoadImageProps = ComponentPropsWithoutRef<typeof LazyLoadImage>;

interface CachedImageProps extends Omit<LazyLoadImageProps, "src"> {
  coverArtId?: string;
  coverArtType?: CoverArt;
  coverArtSize?: string;
  src?: string;
}

/**
 * Drop-in replacement for LazyLoadImage that integrates cover art caching.
 *
 * Use with coverArtId/coverArtType/coverArtSize for automatic caching,
 * or pass a plain `src` to skip caching and behave like a normal image.
 */
export function CachedImage({
  coverArtId,
  coverArtType = "album",
  coverArtSize = "300",
  src: directSrc,
  ...props
}: CachedImageProps) {
  const cachedSrc = useCachedCoverArt(coverArtId, coverArtType, coverArtSize);

  // If a direct src is provided (not using cover art caching), use it as-is
  const finalSrc = directSrc ?? cachedSrc;

  return <LazyLoadImage {...props} src={finalSrc} />;
}
