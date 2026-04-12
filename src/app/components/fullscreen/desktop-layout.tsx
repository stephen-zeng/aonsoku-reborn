import { AnimatePresence, motion } from "framer-motion";
import { ListMusic, Music, X } from "lucide-react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
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

type RightPanelView = "queue" | "lyrics";

export const DesktopLayout = memo(function DesktopLayout() {
  const [rightPanelView, setRightPanelView] = useState<RightPanelView>("queue");
  const { closeFullscreenPlayer } = useFullscreenPlayerState();
  const { t } = useTranslation();

  return (
    <div className="flex h-full w-full gap-0">
      <div className="flex flex-col h-full w-[55%] 2xl:w-[50%] px-8 sm:px-12 pt-6 pb-4 justify-between">
        <div className="flex items-center justify-end gap-2">
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

      <div className="flex flex-col h-full w-[45%] 2xl:w-[50%] border-l border-foreground/10 bg-black/5">
        <div className="flex items-center justify-between px-4 pt-6 pb-2">
          <div className="flex gap-1">
            <Button
              variant={rightPanelView === "queue" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5"
              onClick={() => setRightPanelView("queue")}
            >
              <ListMusic className="size-4" />
              {t("fullscreen.queue")}
            </Button>
            <Button
              variant={rightPanelView === "lyrics" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5"
              onClick={() => setRightPanelView("lyrics")}
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
