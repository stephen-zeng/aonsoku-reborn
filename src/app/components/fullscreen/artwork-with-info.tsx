import { clsx } from "clsx";
import { memo } from "react";
import { CONTENT_MAX_WIDTH } from "./constants";
import { LikeButton } from "./like-button";
import { FullscreenSongArtwork } from "./song-artwork";
import { AlbumName, SongInfo } from "./song-info";

export const FullscreenSongInfoRow = memo(function FullscreenSongInfoRow({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "mx-auto w-full min-w-0 shrink-0 justify-self-center",
        CONTENT_MAX_WIDTH,
        className,
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <SongInfo compact={compact} />
        </div>
        <div className={clsx("shrink-0", compact ? "pt-0.5" : "pt-1")}>
          <LikeButton />
        </div>
      </div>
    </div>
  );
});

export const ArtworkWithInfo = memo(function ArtworkWithInfo({
  className,
  compact = false,
  showTouchDragSurface = false,
  showInfo = true,
}: {
  className?: string;
  compact?: boolean;
  showTouchDragSurface?: boolean;
  showInfo?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex w-full min-h-0 min-w-0 flex-col items-center transition-all duration-300 ease-in-out",
        showInfo ? "flex-1 justify-between" : "justify-center",
        className,
      )}
    >
      <div
        className={clsx(
          "w-full min-h-0 flex flex-col items-center justify-center",
          showInfo ? "flex-1" : "flex-1 min-h-0",
        )}
      >
        <div
          className={clsx(
            "mx-auto w-full min-w-0 shrink-0 justify-self-center",
            CONTENT_MAX_WIDTH,
            compact ? "pb-1" : "pb-2",
          )}
        >
          <AlbumName
            compact={compact}
            className={clsx(
              "[&>div]:py-0.5 [&_p]:leading-normal",
              compact ? "pb-0.5" : "pb-1",
            )}
          />
        </div>

        <div className="min-h-0 w-full flex items-center justify-center overflow-hidden">
          <FullscreenSongArtwork
            compact={compact}
            showTouchDragSurface={showTouchDragSurface}
          />
        </div>
      </div>

      {showInfo && (
        <FullscreenSongInfoRow
          compact={compact}
          className={clsx(compact ? "pt-2" : "pt-4")}
        />
      )}
    </div>
  );
});
