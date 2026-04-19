import { clsx } from "clsx";
import { memo } from "react";
import { CONTENT_MAX_WIDTH } from "./constants";
import { LikeButton } from "./like-button";
import { FullscreenSongArtwork } from "./song-artwork";
import { AlbumName, SongInfo } from "./song-info";

export const ArtworkWithInfo = memo(function ArtworkWithInfo({
  className,
  compact = false,
  showTouchDragSurface = false,
}: {
  className?: string;
  compact?: boolean;
  showTouchDragSurface?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex w-full min-h-0 min-w-0 flex-col items-center",
        compact && "justify-center",
        className,
      )}
    >
      <div
        className={clsx(
          "mx-auto w-full min-w-0 shrink-0 justify-self-center",
          CONTENT_MAX_WIDTH,
          compact ? "pb-2" : "pb-3",
        )}
      >
        <AlbumName compact={compact} />
      </div>

      <FullscreenSongArtwork
        compact={compact}
        showTouchDragSurface={showTouchDragSurface}
      />

      <div
        className={clsx(
          "mx-auto w-full min-w-0 shrink-0 justify-self-center",
          CONTENT_MAX_WIDTH,
          compact ? "pt-2" : "pt-3",
        )}
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <SongInfo compact={compact} />
          </div>
          <div className={clsx("shrink-0", compact ? "pt-0.5" : "pt-1")}>
            <LikeButton />
          </div>
        </div>
      </div>
    </div>
  );
});
