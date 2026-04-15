import { clsx } from "clsx";
import { memo } from "react";
import { CONTENT_MAX_WIDTH } from "./constants";
import { LikeButton } from "./like-button";
import { FullscreenSongArtwork } from "./song-artwork";
import { AlbumName, SongInfo } from "./song-info";

export const ArtworkWithInfo = memo(function ArtworkWithInfo({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex w-full min-h-0 min-w-0 flex-col items-center",
        className,
      )}
    >
      <div className={`w-full min-w-0 ${CONTENT_MAX_WIDTH} pb-3`}>
        <AlbumName />
      </div>

      <FullscreenSongArtwork />

      <div className={`w-full min-w-0 ${CONTENT_MAX_WIDTH} pt-3`}>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <SongInfo />
          </div>
          <div className="shrink-0 pt-1">
            <LikeButton />
          </div>
        </div>
      </div>
    </div>
  );
});
