import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ListMusic, MicVocalIcon } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { useBackdropBg } from "@/app/hooks/use-backdrop-bg";
import { useHasLyrics } from "@/app/hooks/use-has-lyrics";
import { cn } from "@/lib/utils";
import { navigateFromFullscreen } from "@/routes/fullscreenRouter";
import { useFullscreenPlayerState } from "@/store/player.store";
import { ArtworkWithInfo } from "./artwork-with-info";
import { FullscreenControlPanel } from "./control-panel";
import { LyricsTab } from "./lyrics";
import { FullscreenSongQueue } from "./queue";
import { FullscreenSettings } from "./settings";

const MemoLyricsTab = memo(LyricsTab);

export const DesktopLayout = memo(function DesktopLayout() {
  const {
    desktopFullscreenPanelView: rightPanelView,
    setDesktopFullscreenPanelView: setRightPanelView,
  } = useFullscreenPlayerState();
  const { t } = useTranslation();
  const { hasLyrics } = useHasLyrics();
  const backdropBg = useBackdropBg();

  const lyricsDisabled = hasLyrics === false;

  const tabStyle = (view: string) =>
    rightPanelView === view ? { backgroundColor: backdropBg } : undefined;

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
        className={`flex h-full min-w-0 shrink-0 flex-col px-8 pt-6 pb-4 transition-[width] duration-300 sm:px-12 ${rightPanelView ? "w-1/2" : "w-full"}`}
      >
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full hover:bg-foreground/20"
            onClick={navigateFromFullscreen}
            aria-label="Close"
          >
            <ChevronDown className="size-5" />
          </Button>
          <div className="flex-1" />
          {!rightPanelView && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full hover:bg-foreground/20"
                onClick={handleQueueClick}
                aria-label={t("fullscreen.queue")}
              >
                <ListMusic className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`size-10 rounded-full hover:bg-foreground/20 ${lyricsDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={handleLyricsClick}
                disabled={lyricsDisabled}
                aria-label={t("fullscreen.lyrics")}
              >
                <MicVocalIcon className="size-4" />
              </Button>
            </>
          )}
          <FullscreenSettings />
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center min-h-0">
          <div className="flex w-full min-w-0 flex-col items-center max-h-full overflow-y-hidden">
            <ArtworkWithInfo className="flex-1 min-h-0" />
            <FullscreenControlPanel />
          </div>
        </div>
      </div>

      <div
        className={`shrink-0 flex flex-col h-full bg-black/5 overflow-hidden transition-[width] duration-300 ${rightPanelView ? "w-1/2 border-l border-foreground/10" : "w-0"}`}
        style={
          { "--queue-bg-overlay": "rgba(0, 0, 0, 0.05)" } as React.CSSProperties
        }
      >
        <div className="flex items-center justify-between px-4 pt-6 pb-2">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 transition-[background-color] duration-1000",
                rightPanelView === "queue" && "rounded-md",
              )}
              style={tabStyle("queue")}
              onClick={handleQueueClick}
            >
              <ListMusic className="size-4" />
              {t("fullscreen.queue")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 transition-[background-color] duration-1000",
                lyricsDisabled && "opacity-50 cursor-not-allowed",
                rightPanelView === "lyrics" && "rounded-md",
              )}
              style={tabStyle("lyrics")}
              onClick={handleLyricsClick}
              disabled={lyricsDisabled}
            >
              <MicVocalIcon className="size-4" />
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
                <FullscreenSongQueue hideModeButtons />
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
