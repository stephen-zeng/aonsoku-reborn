import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import { Dot } from "@/app/components/dot";
import { usePlayerStore } from "@/store/player.store";
import { CompactSongArtwork } from "./song-artwork";
import { ISong } from "@/types/responses/song";
import { ALBUM_ARTISTS_MAX_NUMBER } from "@/utils/multipleArtists";

export const SongInfo = memo(function SongInfo() {
  const currentSong = usePlayerStore((state) => state.songlist.currentSong);

  return (
    <div className="flex flex-col gap-0.5 w-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSong.id ?? "no-song"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="w-full"
        >
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight line-clamp-2">
            {currentSong.title}
          </h2>
        </motion.div>
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSong.id ?? "no-song-sub"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1], delay: 0.05 }}
          className="w-full"
        >
          <div className="flex gap-1 text-sm text-foreground/70 truncate">
            <p className="truncate text-foreground/80">{currentSong.album}</p>
            <Dot className="text-foreground/70" />
            <ArtistNames song={currentSong} />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

export const CompactSongInfo = memo(function CompactSongInfo() {
  const currentSong = usePlayerStore((state) => state.songlist.currentSong);

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <CompactSongArtwork />
      <div className="flex flex-col min-w-0">
        <p className="text-sm font-medium truncate">{currentSong.title}</p>
        <p className="text-xs text-foreground/70 truncate">
          {currentSong.artist}
        </p>
      </div>
    </div>
  );
});

function ArtistNames({ song }: { song: ISong }) {
  const { artist, artists } = song;

  if (artists && artists.length > 1) {
    const data = artists.slice(0, ALBUM_ARTISTS_MAX_NUMBER);

    return (
      <div className="flex items-center gap-1">
        {data.map(({ id, name }, index) => (
          <div key={id} className="flex">
            <p className="truncate">{name}</p>
            {index < data.length - 1 && ","}
          </div>
        ))}
      </div>
    );
  }

  return <p className="truncate">{artist}</p>;
}
