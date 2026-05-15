import clsx from "clsx";
import { Volume2 } from "lucide-react";
import { memo } from "react";
import { ResizeHandler } from "@/app/components/icons/resize-handler";
import { isDesktop } from "@/utils/desktop";
import { useMiniPlayerContext } from "./context";
import { MiniPlayerControls, MiniPlayerLikeButton } from "./controls";
import { MiniPlayerPopoverVolume } from "./popover-volume";
import { MiniPlayerProgress } from "./progress";
import { MiniPlayerSongImage } from "./song-image";
import { MiniPlayerSongTitle } from "./song-title";
import { MiniPlayerTitleBar } from "./title-bar";
import { MiniPlayerVolume } from "./volume";

const MemoMiniPlayerControls = memo(MiniPlayerControls);
const MemoMiniPlayerLikeButton = memo(MiniPlayerLikeButton);
const MemoMiniPlayerProgress = memo(MiniPlayerProgress);
const MemoMiniPlayerSongImage = memo(MiniPlayerSongImage);
const MemoMiniPlayerSongTitle = memo(MiniPlayerSongTitle);
const MemoMiniPlayerVolume = memo(MiniPlayerVolume);

export function MiniPlayer() {
  const { state } = useMiniPlayerContext();

  if (!state || !state.currentSong) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background text-foreground/50 text-sm">
        Waiting for player...
      </div>
    );
  }

  const currentSongColor = state.currentSongColor;

  return (
    <div
      className="w-screen h-screen max-h-screen relative group overflow-hidden select-none bg-background"
    >
      {/* 
        The background layer handles dragging. 
        In Electron, 'drag' regions swallow mouse events, so we place it BEHIND the content.
      */}
      {isDesktop() && (
        <div
          className="absolute inset-0 z-0"
          style={{ WebkitAppRegion: "drag" }}
        />
      )}

      {/* 
        The content layer handles hover and interaction.
        We set it to 'no-drag' so it can receive mouse events and trigger the :hover state on the root '.group'.
      */}
      <div 
        className="absolute inset-0 z-10 grid grid-rows-1 mid-player:grid-rows-[auto_auto_auto] gap-2 mid-player:gap-mid-player-gap p-1 mid-player:p-mid-player-padding mini-player:p-1.5 pb-4 mid-player:pb-4 mini-player:pb-1.5"
        style={isDesktop() ? { WebkitAppRegion: "no-drag" } : undefined}
      >
        <MiniPlayerTitleBar />

        <div
          className={clsx(
            "w-full h-full gap-2 grid grid-rows-floating-player relative z-10",
            "mid-player:grid-rows-1 mid-player:grid-cols-mid-player-info mid-player:items-center mid-player:gap-mid-player-gap",
            "mini-player:flex mini-player:gap-2 mini-player:items-center",
          )}
        >
          <div
            className={clsx(
              "w-full h-full mid-player:aspect-square",
              "flex flex-col items-center justify-center gap-2",
              "default-gradient rounded-md mini-player:rounded",
              "transition-[background-image,background-color] duration-1000 overflow-hidden",
              "mid-player:!bg-transparent mid-player:from-transparent mid-player:to-transparent",
              "mini-player:!bg-transparent mini-player:from-transparent mini-player:to-transparent",
              "mini-player:w-10 mini-player:h-10 mini-player:shrink-0",
            )}
            style={{ backgroundColor: currentSongColor ?? undefined }}
          >
            <div
              className={clsx(
                "flex w-full h-full relative p-3 justify-center items-center bg-transparent",
                "mid-player:min-h-fit mid-player:max-h-full mid-player:p-0 mid-player:w-mid-player-image mid-player:h-mid-player-image",
                "mini-player:min-h-fit mini-player:max-h-full mini-player:p-0 mini-player:aspect-square",
              )}
            >
              <MemoMiniPlayerSongImage />
              <div
                className={clsx(
                  "flex flex-col w-full gap-4 absolute inset-0",
                  "bg-gradient-to-b from-background/70 via-background/50 via-50% to-background to-90%",
                  "opacity-0 group-hover:opacity-100",
                  "transition-opacity duration-300",
                  "mid-player:hidden mini-player:hidden",
                )}
              >
                <div className="flex flex-col flex-1 px-2 justify-center items-center absolute inset-0">
                  <MemoMiniPlayerControls />
                </div>
                <div className="mb-auto px-2 pt-0.5">
                  <MemoMiniPlayerVolume />
                </div>
                <div className="mt-auto px-2 pb-0.5">
                  <MemoMiniPlayerProgress />
                </div>
              </div>
            </div>
          </div>
          <div
            className={clsx(
              "min-w-12 h-12 flex items-center justify-between pb-2 pl-1 mini-player:h-10",
              "mid-player:pl-0 mini-player:pl-0 mid-player:pb-0 mini-player:pb-0.5 mid-player:flex-1 mid-player:h-mid-player-text-height",
              "mini-player:flex-1 mini-player:min-w-0",
            )}
          >
            <MemoMiniPlayerSongTitle />
            <div className="mid-player:hidden">
              <MemoMiniPlayerLikeButton />
            </div>
          </div>
          <div className="hidden mini-player:group-hover-supported:flex mini-player:w-16 mini-player:shrink-0">
            <MemoMiniPlayerControls />
          </div>
        </div>
        <div className="hidden mid-player:flex mid-player:items-center mid-player:px-2 mid-player:h-mid-player-progress-height w-full relative z-10">
          <MemoMiniPlayerProgress showTime compact />
        </div>
        <div className="hidden mid-player:flex justify-center items-center h-10 max-h-10 relative px-2 z-10">
          <div className="absolute left-2">
            <MemoMiniPlayerLikeButton />
          </div>
          <MemoMiniPlayerControls />
          <div className="absolute right-2">
            <MiniPlayerPopoverVolume>
              <Volume2 size={14} />
            </MiniPlayerPopoverVolume>
          </div>
        </div>
        <ResizeHandler className="absolute w-5 h-5 bottom-0 right-0 text-foreground/50 z-20" />
      </div>
    </div>
  );
}
