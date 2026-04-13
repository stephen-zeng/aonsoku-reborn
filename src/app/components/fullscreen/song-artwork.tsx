import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import { CachedImage } from "@/app/components/cover-image/cached-image";
import { usePlayerStore } from "@/store/player.store";
import { CONTENT_MAX_WIDTH } from "./constants";

export const FullscreenSongArtwork = memo(function FullscreenSongArtwork() {
  const { coverArt, artist, title, id } = usePlayerStore(
    ({ songlist }) => songlist.currentSong,
  );

  return (
    <div className="w-full flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={id ?? "no-song"}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className={`w-full ${CONTENT_MAX_WIDTH} aspect-square`}
        >
          <CachedImage
            coverArtId={coverArt}
            coverArtType="song"
            coverArtSize="700"
            effect="opacity"
            alt={`${artist} - ${title}`}
            className="aspect-square object-cover rounded-md"
            width="100%"
            height="100%"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

export const CompactSongArtwork = memo(function CompactSongArtwork() {
  const { coverArt, artist, title } = usePlayerStore(
    ({ songlist }) => songlist.currentSong,
  );

  return (
    <CachedImage
      coverArtId={coverArt}
      coverArtType="song"
      coverArtSize="100"
      effect="opacity"
      alt={`${artist} - ${title}`}
      className="size-11 rounded object-cover"
      width="44"
      height="44"
    />
  );
});
