import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import { CachedImage } from "@/app/components/cover-image/cached-image";
import { usePlayerStore } from "@/store/player.store";

export const FullscreenSongArtwork = memo(function FullscreenSongArtwork({
  compact = false,
  large = false,
  showTouchDragSurface = false,
}: {
  compact?: boolean;
  large?: boolean;
  showTouchDragSurface?: boolean;
}) {
  const { albumId, coverArt, artist, title, id } = usePlayerStore(
    ({ songlist }) => songlist.currentSong,
  );

  return (
    <div
      className={clsx(
        "relative aspect-square shrink bg-foreground/5 rounded-md overflow-hidden flex items-center justify-center transition-all duration-300 ease-in-out",
        compact
          ? "h-[min(260px,42svh,calc(100vw-2rem))]"
          : large
            ? "h-[min(480px,85vw,60svh)]"
            : "h-[clamp(280px,85vw,480px)]",
        "w-auto max-w-full",
      )}
    >
      {showTouchDragSurface && (
        <div
          className="absolute inset-0 z-10 touch-none"
          data-testid="fullscreen-artwork-touch-drag-surface"
          aria-hidden="true"
        />
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={id ?? "no-song"}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex size-full items-center justify-center"
        >
          <CachedImage
            coverArtId={coverArt}
            coverArtType="song"
            albumId={albumId}
            coverArtSize="700"
            effect="opacity"
            alt={`${artist} - ${title}`}
            className="size-full object-cover rounded-md"
            wrapperClassName="size-full block overflow-hidden"
            width="100%"
            height="100%"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

export const CompactSongArtwork = memo(function CompactSongArtwork() {
  const { albumId, coverArt, artist, title } = usePlayerStore(
    ({ songlist }) => songlist.currentSong,
  );

  return (
    <CachedImage
      coverArtId={coverArt}
      coverArtType="song"
      albumId={albumId}
      coverArtSize="100"
      effect="opacity"
      alt={`${artist} - ${title}`}
      className="size-11 rounded object-cover"
      width="44"
      height="44"
    />
  );
});
