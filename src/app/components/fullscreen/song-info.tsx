import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import { usePlayerStore } from "@/store/player.store";
import { CompactSongArtwork } from "./song-artwork";
import { ScrollingTitle } from "./scrolling-title";
import { ISong } from "@/types/responses/song";
import { ALBUM_ARTISTS_MAX_NUMBER } from "@/utils/multipleArtists";

const TEXT_TRANSITION = { duration: 0.25, ease: [0.4, 0, 0.2, 1] } as const;
const TEXT_TRANSITION_DELAYED = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1],
  delay: 0.05,
} as const;

export const SongInfo = memo(function SongInfo() {
  const currentSong = usePlayerStore((state) => state.songlist.currentSong);

  return (
    <div className="flex flex-col gap-1 w-full overflow-visible">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSong.id ?? "no-song"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={TEXT_TRANSITION}
          className="w-full overflow-visible"
        >
          <ScrollingTitle>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {currentSong.title}
            </h2>
          </ScrollingTitle>
        </motion.div>
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSong.id ?? "no-song-sub"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={TEXT_TRANSITION_DELAYED}
          className="w-full"
        >
          <ScrollingTitle>
            <div className="text-sm text-foreground/70">
              <ArtistNames song={currentSong} />
            </div>
          </ScrollingTitle>
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

export const AlbumName = memo(function AlbumName() {
  const currentSong = usePlayerStore((state) => state.songlist.currentSong);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentSong.id ?? "no-album"}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={TEXT_TRANSITION}
        className="text-center"
      >
        <ScrollingTitle>
          <p className="text-sm text-foreground/70">{currentSong.album}</p>
        </ScrollingTitle>
      </motion.div>
    </AnimatePresence>
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
    return <p>{data.map(({ name }) => name).join(", ")}</p>;
  }

  return <p>{artist}</p>;
}
