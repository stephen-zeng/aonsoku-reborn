import { ListVideo, MicVocalIcon, XIcon } from "lucide-react";
import { ComponentPropsWithoutRef } from "react";
import { useTranslation } from "react-i18next";
import { FullscreenSongQueue } from "@/app/components/fullscreen/queue";
import { LyricsTab } from "@/app/components/fullscreen/lyrics";
import { Button } from "@/app/components/ui/button";
import { ResizeHandle } from "@/app/components/ui/resize-handle";
import { useHasLyrics } from "@/app/hooks/use-has-lyrics";
import { useResizePanel } from "@/app/hooks/use-resize-panel";
import { cn } from "@/lib/utils";
import {
  useLyricsState,
  useMainDrawerState,
  useQueueState,
} from "@/store/player.store";
import { DEFAULT_RIGHT_PANEL_WIDTH, useRightPanel } from "@/store/ui.store";

export function MainDrawerPage() {
  const { mainDrawerState, closeDrawer, toggleQueueAndLyrics } =
    useMainDrawerState();
  const { queueState } = useQueueState();
  const { lyricsState } = useLyricsState();
  const { t } = useTranslation();
  const { setWidth } = useRightPanel();
  const { hasLyrics } = useHasLyrics();

  const lyricsDisabled = hasLyrics === false;

  const { handleMouseDown, handleDoubleClick } = useResizePanel({
    cssVar: "--right-panel-width",
    min: 240,
    max: 480,
    defaultWidth: DEFAULT_RIGHT_PANEL_WIDTH,
    direction: "left",
    onWidthChange: setWidth,
  });

  return (
    <div
      className={cn(
        "fixed top-[--header-height] right-0 bottom-[calc(var(--player-height)+var(--bottom-nav-height))] w-[--right-panel-width] z-30",
        "border-l bg-background-foreground",
        "transition-transform duration-300 ease-in-out",
        "hidden lg:flex flex-col",
        mainDrawerState
          ? "translate-x-0"
          : "translate-x-full pointer-events-none",
      )}
    >
      <ResizeHandle
        side="left"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      />
      <div className="flex flex-col w-full h-full">
        <div className="flex w-full h-12 min-h-12 px-3 items-center gap-1">
          <div className="flex items-center gap-0.5 flex-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3 rounded-full gap-1.5 text-xs font-medium",
                queueState && "bg-foreground/10 text-foreground",
                !queueState &&
                  "text-muted-foreground hover-supported:text-foreground",
              )}
              onClick={() => {
                if (lyricsState) toggleQueueAndLyrics();
              }}
            >
              <ListVideo className="w-3.5 h-3.5" />
              {t("fullscreen.queue")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3 rounded-full gap-1.5 text-xs font-medium",
                lyricsDisabled && "opacity-50 cursor-not-allowed",
                !lyricsDisabled &&
                  (lyricsState
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover-supported:text-foreground"),
              )}
              onClick={() => {
                if (lyricsDisabled) return;
                if (queueState) toggleQueueAndLyrics();
              }}
              disabled={lyricsDisabled}
            >
              <MicVocalIcon className="w-3.5 h-3.5" />
              {t("fullscreen.lyrics")}
            </Button>
          </div>
          <Button
            variant="ghost"
            className="w-8 h-8 rounded-full p-0 hover-supported:bg-foreground/20"
            onClick={closeDrawer}
          >
            <XIcon className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-1 relative overflow-hidden">
          <ActiveContent active={queueState}>
            <FullscreenSongQueue
              hideHistory
              hideCurrentSong
              hideModeButtons
              hideRepeatIndicator
              useVirtualization
              scrollAreaClassName="w-full h-full overflow-auto"
            />
          </ActiveContent>
          <ActiveContent active={lyricsState}>
            <LyricsTab />
          </ActiveContent>
        </div>
      </div>
    </div>
  );
}

type ActiveContentProps = ComponentPropsWithoutRef<"div"> & {
  active: boolean;
};

function ActiveContent({
  active,
  children,
  className,
  ...props
}: ActiveContentProps) {
  return (
    <div
      className={cn(
        "w-full h-full absolute inset-0 opacity-0 pointer-events-none transition-opacity duration-300 bg-black/0",
        active && "opacity-100 pointer-events-auto",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
