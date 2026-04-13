import { memo } from "react";
import { CONTENT_MAX_WIDTH } from "./constants";
import { LikeButton } from "./like-button";
import { FullscreenSongArtwork } from "./song-artwork";
import { AlbumName, SongInfo } from "./song-info";

export const ArtworkWithInfo = memo(function ArtworkWithInfo() {
  return (
    <div className="w-full flex flex-col items-center">
      <div className={`w-full ${CONTENT_MAX_WIDTH} pb-3`}>
        <AlbumName />
      </div>

      <FullscreenSongArtwork />

      <div className={`w-full ${CONTENT_MAX_WIDTH} pt-3`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 overflow-visible">
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
