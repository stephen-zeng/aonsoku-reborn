import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import { CachedImage } from "@/app/components/cover-image/cached-image";
import { usePlayerStore } from "@/store/player.store";

export const FullscreenSongArtwork = memo(function FullscreenSongArtwork() {
  const { coverArt, artist, title, id } = usePlayerStore(
    ({ songlist }) => songlist.currentSong,
  );

  return (
    <div className="w-full flex items-center justify-center px-6 sm:px-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={id ?? "no-song"}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-[min(85vw,400px)] sm:max-w-[min(50vw,480px)] aspect-square"
        >
          <CachedImage
            coverArtId={coverArt}
            coverArtType="song"
            coverArtSize="700"
            effect="opacity"
            alt={`${artist} - ${title}`}
            className="aspect-square object-cover rounded-2xl shadow-2xl"
            width="100%"
            height="100%"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
});
