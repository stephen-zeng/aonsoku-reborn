import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ListMusic, Music } from "lucide-react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { useFullscreenPlayerState } from "@/store/player.store";
import { FullscreenControls } from "./controls";
import { LikeButton } from "./like-button";
import { LyricsTab } from "./lyrics";
import { FullscreenProgress } from "./progress";
import { FullscreenSongQueue } from "./queue";
import { FullscreenSongArtwork } from "./song-artwork";
import { SongInfo } from "./song-info";

const MemoSongQueue = memo(FullscreenSongQueue);
const MemoLyricsTab = memo(LyricsTab);

type MobileView = "playing" | "lyrics" | "queue";

export const MobileLayout = memo(function MobileLayout() {
  const [view, setView] = useState<MobileView>("playing");
  const { closeFullscreenPlayer } = useFullscreenPlayerState();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full w-full relative">
      <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-4 pt-1 z-20">
        <AnimatePresence mode="wait">
          {view !== "playing" ? (
            <motion.div
              key="back"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full hover:bg-foreground/20"
                onClick={() => setView("playing")}
              >
                <ChevronLeft className="size-5" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="close"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
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
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "playing" && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="flex flex-col h-full justify-center px-4 pt-12 pb-2"
            >
              <div className="flex-1 flex items-center justify-center min-h-0">
                <FullscreenSongArtwork />
              </div>

              <div className="flex flex-col gap-2 pt-5 pb-1 shrink-0">
                <SongInfo />
                <FullscreenProgress />
                <div className="flex items-center justify-center gap-1 pt-1">
                  <LikeButton />
                  <FullscreenControls />
                </div>
                <div className="flex items-center justify-center gap-4 pt-1 pb-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-foreground/70 hover:text-foreground hover:bg-foreground/10 gap-1.5"
                    onClick={() => setView("lyrics")}
                  >
                    <Music className="size-4" />
                    <span className="text-xs">{t("fullscreen.lyrics")}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-foreground/70 hover:text-foreground hover:bg-foreground/10 gap-1.5"
                    onClick={() => setView("queue")}
                  >
                    <ListMusic className="size-4" />
                    <span className="text-xs">{t("fullscreen.queue")}</span>
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {view === "lyrics" && (
            <motion.div
              key="lyrics"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="h-full pt-12 px-2"
              data-vaul-no-drag
            >
              <MemoLyricsTab />
            </motion.div>
          )}

          {view === "queue" && (
            <motion.div
              key="queue"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="h-full pt-12 px-2"
              data-vaul-no-drag
            >
              <MemoSongQueue />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
