import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import { Dot } from "@/app/components/dot";
import { Badge } from "@/app/components/ui/badge";
import { usePlayerStore } from "@/store/player.store";
import { ISong } from "@/types/responses/song";
import { ALBUM_ARTISTS_MAX_NUMBER } from "@/utils/multipleArtists";

export const SongInfo = memo(function SongInfo() {
  const currentSong = usePlayerStore((state) => state.songlist.currentSong);

  return (
    <div className="flex flex-col items-center sm:items-start gap-0.5 sm:gap-1 w-full overflow-hidden px-2 sm:px-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSong.id ?? "no-song"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="w-full text-center sm:text-left"
        >
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight drop-shadow-lg line-clamp-2">
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
          className="w-full text-center sm:text-left"
        >
          <div className="flex gap-1 text-foreground/70 justify-center sm:justify-start truncate text-sm sm:text-base">
            <p className="truncate drop-shadow-lg text-foreground/90">
              {currentSong.album}
            </p>
            <Dot className="text-foreground/70" />
            <ArtistNames song={currentSong} />
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="flex gap-2 mt-1 justify-center sm:justify-start">
        {currentSong.genre && (
          <Badge variant="neutral">{currentSong.genre}</Badge>
        )}
        {currentSong.year && (
          <Badge variant="neutral">{currentSong.year}</Badge>
        )}
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
            <p className="truncate drop-shadow-lg">{name}</p>
            {index < data.length - 1 && ","}
          </div>
        ))}
      </div>
    );
  }

  return <p className="truncate drop-shadow-lg">{artist}</p>;
}
