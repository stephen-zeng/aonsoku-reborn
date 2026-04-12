import { AnimatePresence, motion } from "framer-motion";
import { ListMusic, Music, X } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { useHasLyrics } from "@/app/hooks/use-has-lyrics";
import { useFullscreenPlayerState } from "@/store/player.store";
import { FullscreenControls } from "./controls";
import { LikeButton } from "./like-button";
import { LyricsTab } from "./lyrics";
import { FullscreenProgress } from "./progress";
import { FullscreenSongQueue } from "./queue";
import { FullscreenSettings } from "./settings";
import { FullscreenSongArtwork } from "./song-artwork";
import { SongInfo } from "./song-info";
import { VolumeContainer } from "./volume-container";

const MemoSongQueue = memo(FullscreenSongQueue);
const MemoLyricsTab = memo(LyricsTab);

export const DesktopLayout = memo(function DesktopLayout() {
  const {
    closeFullscreenPlayer,
    desktopFullscreenPanelView: rightPanelView,
    setDesktopFullscreenPanelView: setRightPanelView,
  } = useFullscreenPlayerState();
  const { t } = useTranslation();
  const { hasLyrics } = useHasLyrics();

  const lyricsDisabled = hasLyrics === false;

  function handleQueueClick() {
    setRightPanelView(rightPanelView === "queue" ? null : "queue");
  }

  function handleLyricsClick() {
    if (lyricsDisabled) return;
    setRightPanelView(rightPanelView === "lyrics" ? null : "lyrics");
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div
        className={`flex flex-col h-full shrink-0 px-8 sm:px-12 pt-6 pb-4 justify-between transition-[width] duration-300 ${rightPanelView ? "w-1/2" : "w-full"}`}
      >
        <div className="flex items-center justify-end gap-2">
          {!rightPanelView && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full hover:bg-foreground/20"
                onClick={handleQueueClick}
              >
                <ListMusic className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`size-10 rounded-full hover:bg-foreground/20 ${lyricsDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={handleLyricsClick}
                disabled={lyricsDisabled}
              >
                <Music className="size-4" />
              </Button>
            </>
          )}
          <FullscreenSettings />
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full hover:bg-foreground/20"
            onClick={() => closeFullscreenPlayer()}
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center min-h-0 py-4">
          <FullscreenSongArtwork />
        </div>

        <div className="flex flex-col gap-3 pb-2">
          <SongInfo />
          <FullscreenProgress />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
            <div className="flex w-[180px] justify-start">
              <LikeButton />
            </div>
            <div className="flex flex-1 justify-center items-center gap-1 sm:gap-2">
              <FullscreenControls />
            </div>
            <div className="flex w-[180px] justify-end">
              <VolumeContainer />
            </div>
          </div>
        </div>
      </div>

      <div
        className={`shrink-0 flex flex-col h-full border-l border-foreground/10 bg-black/5 overflow-hidden transition-[width] duration-300 ${rightPanelView ? "w-1/2" : "w-0"}`}
      >
        <div className="flex items-center justify-between px-4 pt-6 pb-2">
          <div className="flex gap-1">
            <Button
              variant={rightPanelView === "queue" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5"
              onClick={handleQueueClick}
            >
              <ListMusic className="size-4" />
              {t("fullscreen.queue")}
            </Button>
            <Button
              variant={rightPanelView === "lyrics" ? "secondary" : "ghost"}
              size="sm"
              className={`gap-1.5 ${lyricsDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={handleLyricsClick}
              disabled={lyricsDisabled}
            >
              <Music className="size-4" />
              {t("fullscreen.lyrics")}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-2 pb-4" data-vaul-no-drag>
          <AnimatePresence mode="wait">
            {rightPanelView === "queue" && (
              <motion.div
                key="queue"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="h-full"
              >
                <MemoSongQueue />
              </motion.div>
            )}
            {rightPanelView === "lyrics" && (
              <motion.div
                key="lyrics"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="h-full"
              >
                <MemoLyricsTab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});
