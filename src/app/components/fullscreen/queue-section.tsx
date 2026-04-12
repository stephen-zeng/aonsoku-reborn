import { memo, useCallback } from "react";
import { getCoverArtUrl } from "@/api/httpClient";
import { usePlayerActions } from "@/store/player.store";
import type { ISong } from "@/types/responses/song";

interface QueueSectionProps {
  title: string;
  songs: ISong[];
  currentSong: ISong;
  isPlaying: boolean;
  startIndex: number;
  fullList: ISong[];
}

export function QueueSection({
  title,
  songs,
  currentSong,
  isPlaying,
  startIndex,
  fullList,
}: QueueSectionProps) {
  const { setSongList } = usePlayerActions();

  const handlePlay = useCallback(
    (globalIndex: number) => {
      setSongList(fullList, globalIndex);
    },
    [setSongList, fullList],
  );

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between px-2 py-1 shrink-0">
        <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0" data-vaul-no-drag>
        {songs.map((song, idx) => {
          const globalIndex = startIndex + idx;
          const isActive = currentSong.id === song.id;
          return (
            <QueueRow
              key={song.id}
              song={song}
              isActive={isActive}
              isPlaying={isActive && isPlaying}
              globalIndex={globalIndex}
              onPlay={handlePlay}
            />
          );
        })}
      </div>
    </div>
  );
}

interface QueueRowProps {
  song: ISong;
  isActive: boolean;
  isPlaying: boolean;
  globalIndex: number;
  onPlay: (index: number) => void;
}

const QueueRow = memo(function QueueRow({
  song,
  isActive,
  globalIndex,
  onPlay,
}: QueueRowProps) {
  const coverArtUrl = getCoverArtUrl(song.coverArt, "song", "100");

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
        isActive ? "bg-accent" : ""
      }`}
      onClick={() => onPlay(globalIndex)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay(globalIndex);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="w-9 h-9 rounded shrink-0 overflow-hidden bg-accent">
        <img
          src={coverArtUrl}
          className="w-9 h-9 object-cover"
          alt={`${song.title} - ${song.artist}`}
          loading="lazy"
        />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span
          className={`text-sm font-medium truncate ${
            isActive ? "text-primary" : ""
          }`}
        >
          {song.title}
        </span>
        <span className="text-xs text-foreground/70 truncate">
          {song.artist}
        </span>
      </div>
    </div>
  );
});
