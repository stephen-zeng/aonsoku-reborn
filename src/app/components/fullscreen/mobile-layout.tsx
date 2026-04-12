import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ListMusic, Music, X } from "lucide-react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { useHasLyrics } from "@/app/hooks/use-has-lyrics";
import { useFullscreenPlayerState, usePlayerStore } from "@/store/player.store";
import { FullscreenControls } from "./controls";
import { LikeButton } from "./like-button";
import { LyricsTab } from "./lyrics";
import { FullscreenProgress } from "./progress";
import { FullscreenSongQueue } from "./queue";
import { FullscreenSongArtwork } from "./song-artwork";
import { SongInfo } from "./song-info";

const MemoSongQueue = memo(FullscreenSongQueue);
const MemoLyricsTab = memo(LyricsTab);
const MemoSongInfo = memo(SongInfo);

type MobileView = "playing" | "lyrics" | "queue";

function MobileMiniSongInfo() {
  const currentSong = usePlayerStore((state) => state.songlist.currentSong);

  return (
    <div className="flex items-center gap-2 min-h-0 truncate">
      <p className="text-sm font-medium truncate drop-shadow-lg">
        {currentSong.title}
      </p>
      <span className="text-sm text-foreground/70">·</span>
      <p className="text-sm text-foreground/70 truncate drop-shadow-lg">
        {currentSong.artist}
      </p>
    </div>
  );
}

export const MobileLayout = memo(function MobileLayout() {
  const [view, setView] = useState<MobileView>("playing");
  const { closeFullscreenPlayer } = useFullscreenPlayerState();
  const { t } = useTranslation();
  const { hasLyrics } = useHasLyrics();

  const lyricsDisabled = hasLyrics === false;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-2 pt-1 pb-1 shrink-0 z-20 min-h-[40px]">
        <AnimatePresence mode="wait">
          {view === "playing" ? (
            <motion.div
              key="close"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full hover:bg-foreground/20"
                onClick={() => closeFullscreenPlayer()}
              >
                <ChevronDown className="size-5" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="back"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1"
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full hover:bg-foreground/20"
                onClick={() => setView("playing")}
              >
                <ChevronLeft className="size-5" />
              </Button>
              {view === "lyrics" && <MobileMiniSongInfo />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content area - switches between cover+info, lyrics, and queue */}
      <div className="flex-1 overflow-hidden min-h-0">
        <AnimatePresence mode="wait">
          {view === "playing" && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="flex flex-col h-full justify-center px-4"
            >
              <div className="flex-1 flex items-center justify-center min-h-0">
                <FullscreenSongArtwork />
              </div>
              <div className="pt-4 shrink-0">
                <MemoSongInfo />
              </div>
            </motion.div>
          )}

          {view === "lyrics" && (
            <motion.div
              key="lyrics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="h-full px-2"
              data-vaul-no-drag
            >
              <MemoLyricsTab />
            </motion.div>
          )}

          {view === "queue" && (
            <motion.div
              key="queue"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="h-full px-2"
              data-vaul-no-drag
            >
              <MemoSongQueue />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom controls - always visible */}
      <div className="shrink-0 px-4 pb-2 pt-1">
        <FullscreenProgress />
        <div className="flex items-center justify-center gap-1 pt-1">
          <LikeButton />
          <FullscreenControls />
        </div>
        <div className="flex items-center justify-center gap-3 pt-1 pb-1">
          {view !== "playing" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-foreground/90 hover:text-foreground hover:bg-foreground/10 gap-1.5"
              onClick={() => setView("playing")}
            >
              <X className="size-3.5" />
              <span className="text-xs">{t("fullscreen.playing")}</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 ${
              lyricsDisabled
                ? "opacity-50 cursor-not-allowed text-foreground/70"
                : view === "lyrics"
                  ? "text-foreground hover:text-foreground"
                  : "text-foreground/70 hover:text-foreground hover:bg-foreground/10"
            }`}
            onClick={() =>
              !lyricsDisabled &&
              setView(view === "lyrics" ? "playing" : "lyrics")
            }
            disabled={lyricsDisabled}
          >
            <Music className="size-4" />
            <span className="text-xs">{t("fullscreen.lyrics")}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 ${
              view === "queue"
                ? "text-foreground hover:text-foreground"
                : "text-foreground/70 hover:text-foreground hover:bg-foreground/10"
            }`}
            onClick={() => setView(view === "queue" ? "playing" : "queue")}
          >
            <ListMusic className="size-4" />
            <span className="text-xs">{t("fullscreen.queue")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
});
