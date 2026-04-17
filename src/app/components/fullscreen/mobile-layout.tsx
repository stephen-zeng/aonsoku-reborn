import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ListMusic, MicVocalIcon } from "lucide-react";
import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { DrawerHandle } from "@/app/components/ui/drawer";
import { useHasLyrics } from "@/app/hooks/use-has-lyrics";
import { useIsShortViewport, useIsWideViewport } from "@/app/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  closeFullscreenPlayerWithHistory,
  setFullscreenTabWithHistory,
} from "@/routes/fullscreenRouter";
import {
  useFullscreenPlayerState,
  useLyricsAlignment,
  useSongColor,
} from "@/store/player.store";
import { ArtworkWithInfo } from "./artwork-with-info";
import { PANEL_MAX_WIDTH } from "./constants";
import { FullscreenControlPanel } from "./control-panel";
import { LyricsTab } from "./lyrics";
import { FullscreenSongQueue } from "./queue";
import { QueueCurrentSong } from "./queue-current-song";
import { FullscreenSettings } from "./settings";

const MemoLyricsTab = memo(LyricsTab);

const VIEW_TRANSITION = { duration: 0.2, ease: [0.4, 0, 0.2, 1] } as const;

const HEADER_ICON = <ChevronDown className="size-5" />;

const MobileHeader = memo(function MobileHeader({
  onClose,
  showDragHandle = false,
  compact = false,
}: {
  onClose: () => void;
  showDragHandle?: boolean;
  compact?: boolean;
}) {
  const { currentSongColor } = useSongColor();

  return (
    <div
      className={cn(
        "relative flex items-center justify-between px-3 shrink-0 min-h-[32px] z-20",
        compact ? "pt-0 pb-1" : "pt-0.5 pb-1.5",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-10 rounded-full hover:bg-foreground/20"
        onClick={onClose}
        aria-label="Close"
      >
        {HEADER_ICON}
      </Button>

      {showDragHandle && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 flex justify-center">
          <DrawerHandle
            preventCycle
            data-testid="fullscreen-drag-handle"
            aria-label="Drag to close"
            className="opacity-100"
            style={{ backgroundColor: currentSongColor ?? "hsl(var(--primary))" }}
          />
        </div>
      )}

      <FullscreenSettings />
    </div>
  );
});

function MobileTabButton({
  icon,
  active,
  disabled = false,
  onClick,
  label,
}: {
  icon: ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      role="tab"
      aria-selected={active}
      className={cn(
        "size-10 rounded-full",
        disabled && "opacity-50 cursor-not-allowed text-foreground/70",
        !disabled &&
          active &&
          "text-foreground hover:text-foreground bg-foreground/10",
        !disabled &&
          !active &&
          "text-foreground/70 hover:text-foreground hover:bg-foreground/10",
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {icon}
    </Button>
  );
}

const MobileBottomTabs = memo(function MobileBottomTabs() {
  const { t } = useTranslation();
  const { fullscreenPlayerTab } = useFullscreenPlayerState();
  const { hasLyrics } = useHasLyrics();

  const lyricsDisabled = hasLyrics === false;

  return (
    <div
      className="shrink-0 flex items-center justify-center gap-4 pt-1 pb-2"
      role="tablist"
    >
      <MobileTabButton
        icon={<MicVocalIcon className="size-5" />}
        label={t("fullscreen.lyrics")}
        active={fullscreenPlayerTab === "lyrics"}
        disabled={lyricsDisabled}
        onClick={() =>
          setFullscreenTabWithHistory(
            fullscreenPlayerTab === "lyrics" ? "playing" : "lyrics",
          )
        }
      />
      <MobileTabButton
        icon={<ListMusic className="size-5" />}
        label={t("fullscreen.queue")}
        active={fullscreenPlayerTab === "queue"}
        onClick={() =>
          setFullscreenTabWithHistory(
            fullscreenPlayerTab === "queue" ? "playing" : "queue",
          )
        }
      />
    </div>
  );
});

export const MobileLayout = memo(function MobileLayout({
  showDragHandle = false,
}: {
  showDragHandle?: boolean;
}) {
  const { fullscreenPlayerTab } = useFullscreenPlayerState();
  const areLyricsAligned = useLyricsAlignment();
  const isShortViewport = useIsShortViewport();
  const isWideViewport = useIsWideViewport();
  const useWideCenteredPlayingLayout =
    fullscreenPlayerTab === "playing" && isWideViewport && !isShortViewport;
  const useShortCompactPlayingLayout =
    fullscreenPlayerTab === "playing" && isShortViewport;
  const playingViewLayout = useShortCompactPlayingLayout
    ? "short-compact"
    : useWideCenteredPlayingLayout
      ? "wide-centered"
      : "default";

  return (
    <div
      className="flex flex-col h-full w-full"
      data-testid="fullscreen-mobile-layout"
    >
      <MobileHeader
        onClose={closeFullscreenPlayerWithHistory}
        showDragHandle={showDragHandle}
        compact={useShortCompactPlayingLayout}
      />

      <div className="flex-1 min-h-0 flex flex-col">
        <AnimatePresence mode="wait">
          {fullscreenPlayerTab === "playing" && (
            <motion.div
              key="playing-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={VIEW_TRANSITION}
              data-testid="fullscreen-playing-view"
              data-layout={playingViewLayout}
              className={cn(
                "flex min-h-0 flex-1 flex-col items-center overflow-hidden",
                useWideCenteredPlayingLayout && "justify-center",
                useShortCompactPlayingLayout && "justify-between",
              )}
            >
              <ArtworkWithInfo
                compact={useShortCompactPlayingLayout}
                className={cn(
                  "w-full",
                  useShortCompactPlayingLayout ? "flex-1 px-4" : "min-h-0",
                )}
              />
              <FullscreenControlPanel
                compact={useShortCompactPlayingLayout}
                expanded={
                  !useShortCompactPlayingLayout && !useWideCenteredPlayingLayout
                }
              />
            </motion.div>
          )}

          {fullscreenPlayerTab === "lyrics" && (
            <motion.div
              key="lyrics-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={VIEW_TRANSITION}
              className={`flex-1 overflow-hidden min-h-0 mx-auto w-full flex flex-col ${PANEL_MAX_WIDTH}`}
              data-vaul-no-drag
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 px-2 pt-2 pb-1">
                <QueueCurrentSong />
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <MemoLyricsTab />
              </div>
              <AnimatePresence>
                {areLyricsAligned && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <FullscreenControlPanel compact />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {fullscreenPlayerTab === "queue" && (
            <motion.div
              key="queue-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={VIEW_TRANSITION}
              className={`flex-1 overflow-hidden min-h-0 mx-auto w-full ${PANEL_MAX_WIDTH}`}
              data-vaul-no-drag
              onClick={(e) => e.stopPropagation()}
              style={
                { "--queue-bg-overlay": "transparent" } as React.CSSProperties
              }
            >
              <FullscreenSongQueue />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <MobileBottomTabs />
    </div>
  );
});
