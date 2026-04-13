import { memo } from "react";
import { LikeButton } from "./like-button";
import { FullscreenSongArtwork } from "./song-artwork";
import { AlbumName, SongInfo } from "./song-info";

const CONTENT_MAX_WIDTH = "max-w-[min(85vw,400px)] sm:max-w-[min(50vw,480px)]";

export const ArtworkWithInfo = memo(function ArtworkWithInfo() {
  return (
    <div className="w-full flex flex-col items-center">
      <div className={`w-full ${CONTENT_MAX_WIDTH} pb-2`}>
        <AlbumName />
      </div>

      <FullscreenSongArtwork />

      <div className={`w-full ${CONTENT_MAX_WIDTH} pt-2`}>
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
