import { ComponentPropsWithoutRef } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { getCoverArtUrl } from "@/api/httpClient";
import { CoverArt } from "@/types/coverArtType";

type LazyLoadImageProps = ComponentPropsWithoutRef<typeof LazyLoadImage>;

interface CachedImageProps extends Omit<LazyLoadImageProps, "src"> {
  coverArtId?: string;
  coverArtType?: CoverArt;
  coverArtSize?: string;
  src?: string;
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
  src: directSrc,
  ...props
}: CachedImageProps) {
  const resolvedSrc =
    directSrc ?? getCoverArtUrl(coverArtId, coverArtType, coverArtSize);

  return <LazyLoadImage {...props} src={resolvedSrc} />;
}
