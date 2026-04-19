import { ComponentPropsWithoutRef } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { CoverArt } from "@/types/coverArtType";
import { useCoverArtUrlFromSongPreference } from "@/utils/coverArt";

type LazyLoadImageProps = ComponentPropsWithoutRef<typeof LazyLoadImage>;

interface CachedImageProps extends Omit<LazyLoadImageProps, "src"> {
  coverArtId?: string;
  coverArtType?: CoverArt;
  coverArtSize?: string;
  albumId?: string;
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
  const resolvedSrc = directSrc ?? generatedSrc;

  return <LazyLoadImage {...props} src={resolvedSrc} />;
}
