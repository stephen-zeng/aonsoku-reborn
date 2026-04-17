import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import { CachedImage } from "@/app/components/cover-image/cached-image";
import { usePlayerStore } from "@/store/player.store";
import { CONTENT_MAX_WIDTH } from "./constants";

export const FullscreenSongArtwork = memo(function FullscreenSongArtwork({
  compact = false,
  showTouchDragSurface = false,
}: {
  compact?: boolean;
  showTouchDragSurface?: boolean;
}) {
  const { coverArt, artist, title, id } = usePlayerStore(
    ({ songlist }) => songlist.currentSong,
  );

  return (
    <div
      className={clsx(
        "relative flex w-full min-h-0 max-h-full items-center justify-center",
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
          className={clsx(
            "relative aspect-square w-full bg-foreground/5 rounded-md overflow-hidden flex items-center justify-center",
            !compact && "fullscreen-desktop-artwork",
            compact
              ? "max-h-[42svh] max-w-[260px]"
              : `${CONTENT_MAX_WIDTH} max-h-full`,
          )}
        >
          <CachedImage
            coverArtId={coverArt}
            coverArtType="song"
            coverArtSize="700"
            effect="opacity"
            alt={`${artist} - ${title}`}
            className="aspect-square object-cover rounded-md"
            wrapperClassName="size-full block"
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
