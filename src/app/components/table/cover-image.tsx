import { CachedImage } from "@/app/components/cover-image/cached-image";
import { EqualizerBars } from "@/app/components/icons/equalizer-bars";
import { useHasHover } from "@/app/hooks/use-input-mode";
import { cn } from "@/lib/utils";
import { Pause, PlayIcon } from "lucide-react";
import { CoverArt } from "@/types/coverArtType";

interface CoverImageProps {
  coverArt: string;
  coverArtType: CoverArt;
  albumId?: string;
  coverArtSize?: number;
  size?: number;
  altText: string;
  onPlayPause?: () => void;
  isCurrentPlaying?: boolean;
}

export function CoverImage({
  coverArt,
  coverArtType,
  albumId,
  coverArtSize = 100,
  size = 40,
  altText,
  onPlayPause,
  isCurrentPlaying = false,
}: CoverImageProps) {
  const hasHover = useHasHover();

  const showOverlay = !!onPlayPause && hasHover;
  const iconSize = Math.round(size * 0.4);

  const image = (
    <CachedImage
      coverArtId={coverArt}
      coverArtType={coverArtType}
      albumId={albumId}
      coverArtSize={coverArtSize.toString()}
      alt={altText}
      effect="opacity"
      width={size}
      height={size}
      className="aspect-square object-cover bg-center"
    />
  );

  if (showOverlay) {
    return (
      <div
        className="bg-skeleton overflow-hidden rounded shadow aspect-square relative"
        style={{
          width: size,
          height: size,
          maxWidth: size,
          maxHeight: size,
          minWidth: size,
          minHeight: size,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onPlayPause();
        }}
      >
        {image}
        {isCurrentPlaying && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/40 rounded transition-opacity opacity-100 group-hover/tablerow:opacity-0"
            role="status"
            aria-label="Currently playing"
          >
            <EqualizerBars size={iconSize} className="text-white" />
          </div>
        )}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/40 rounded transition-opacity",
            isCurrentPlaying
              ? "opacity-0 group-hover/tablerow:opacity-100"
              : "opacity-0 group-hover/tablerow:opacity-100",
          )}
        >
          {isCurrentPlaying ? (
            <Pause
              size={iconSize}
              className="text-white fill-white"
            />
          ) : (
            <PlayIcon
              size={iconSize}
              className="text-white fill-white"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-skeleton overflow-hidden rounded shadow aspect-square relative"
      style={{
        width: size,
        height: size,
        maxWidth: size,
        maxHeight: size,
        minWidth: size,
        minHeight: size,
      }}
    >
      {image}
      {isCurrentPlaying && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/40 rounded"
          role="status"
          aria-label="Currently playing"
        >
          <EqualizerBars size={iconSize} className="text-white" />
        </div>
      )}
    </div>
  );
}