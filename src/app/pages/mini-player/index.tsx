import * as PopoverPrimitive from "@radix-ui/react-popover";
import { QueryClientProvider } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  Heart,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import "@/fonts.css";
import "@/themes.css";
import "@/index.css";
import "@/i18n";

import { CachedImage } from "@/app/components/cover-image/cached-image";
import { MarqueeTitle } from "@/app/components/fullscreen/marquee-title";
import RepeatOne from "@/app/components/icons/repeat-one";
import { ResizeHandler } from "@/app/components/icons/resize-handler";
import { Button } from "@/app/components/ui/button";
import { Slider } from "@/app/components/ui/slider";
import { appThemes } from "@/app/observers/theme-observer";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/store/theme.store";
import { isDarkTheme, Theme, ThemeMode } from "@/types/themeContext";
import { convertSecondsToTime } from "@/utils/convertSecondsToTime";
import { hasElectronBridge } from "@/utils/desktop";
import {
  listenMiniPlayerUpdates,
  type MiniPlayerState,
  requestState,
  sendControlAction,
} from "@/utils/mini-player-sync";
import { setDesktopTitleBarColors, updatePwaThemeColor } from "@/utils/theme";

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  const root = window.document.documentElement;
  root.classList.remove(...appThemes);
  root.classList.add(theme);
  setDesktopTitleBarColors();
  updatePwaThemeColor();
  if (hasElectronBridge()) {
    window.api.setNativeTheme(isDarkTheme(theme));
  }
}

function ThemeInitializer() {
  const themeMode = useThemeStore((s) => s.themeMode);
  const lightTheme = useThemeStore((s) => s.lightTheme);
  const darkTheme = useThemeStore((s) => s.darkTheme);
  const currentTheme = useThemeStore((s) => s.theme);

  useEffect(() => {
    let resolved: Theme;
    switch (themeMode) {
      case ThemeMode.Light:
        resolved = lightTheme;
        break;
      case ThemeMode.Dark:
        resolved = darkTheme;
        break;
      case ThemeMode.System:
      default:
        resolved = getSystemPrefersDark() ? darkTheme : lightTheme;
        break;
    }
    if (resolved !== currentTheme) {
      useThemeStore.getState().setTheme(resolved);
    } else {
      applyTheme(resolved);
    }
  }, [themeMode, lightTheme, darkTheme, currentTheme]);

  return null;
}

const LOOP_OFF = "off";
const LOOP_ALL = "all";
const LOOP_ONE = "one";

const buttonsStyle = {
  main: "w-9 h-9 p-0 rounded-full bg-secondary-foreground",
  mainIcon: "text-secondary fill-secondary",
  secondary:
    "relative w-9 h-9 p-0 rounded-full text-secondary-foreground hover-supported:text-secondary-foreground data-[state=active]:text-primary hover-supported:bg-transparent",
  secondaryIconFilled: "text-secondary-foreground fill-secondary-foreground",
  activeDot: "mini-player-button-active",
  style: {
    backfaceVisibility: "hidden" as const,
  },
  removeRing:
    "focus-visible:ring-0 focus-visible:ring-transparent ring-0 ring-offset-transparent",
};

function getArtistsText(
  song: NonNullable<MiniPlayerState["currentSong"]>,
): string {
  return song.artist;
}

function MiniPlayerPageContent() {
  const [state, setState] = useState<MiniPlayerState | null>(null);

  useEffect(() => {
    const unsubscribe = listenMiniPlayerUpdates(setState);
    requestState();
    return unsubscribe;
  }, []);

  if (!state || !state.currentSong) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background text-foreground/50 text-sm">
        Waiting for player...
      </div>
    );
  }

  const song = state.currentSong;
  const displayTitle = song.title;
  const displaySubtitle = getArtistsText(song);

  return (
    <div className="w-screen h-screen max-h-screen grid grid-rows-1 mid-player:grid-rows-[auto_auto_auto] gap-2 mid-player:gap-mid-player-gap p-1 mid-player:p-mid-player-padding mini-player:p-1.5 pb-4 mid-player:pb-4 relative">
      <div
        className={clsx(
          "w-full h-full gap-2 grid grid-rows-floating-player",
          "mid-player:grid-rows-1 mid-player:grid-cols-mid-player-info mid-player:items-center mid-player:gap-mid-player-gap",
          "mini-player:flex mini-player:gap-2 mini-player:items-center",
          "group",
        )}
      >
        <MiniPlayerSongImage
          song={song}
          color={state.currentSongColor}
          state={state}
        />
        <div
          className={clsx(
            "min-w-12 h-12 flex items-center justify-between pb-2 pl-1 mini-player:h-10",
            "mid-player:pl-0 mini-player:pl-0 mid-player:pb-0 mini-player:pb-0.5 mid-player:flex-1 mid-player:h-mid-player-text-height",
            "mini-player:flex-1 mini-player:min-w-0",
          )}
        >
          <MiniPlayerSongTitle
            displayTitle={displayTitle}
            displaySubtitle={displaySubtitle}
            state={state}
          />
          <div className="mid-player:hidden">
            <MiniPlayerLikeButton starred={state.isSongStarred} />
          </div>
        </div>
        <div className="hidden mini-player:group-hover-supported:flex mini-player:w-16 mini-player:shrink-0">
          <MiniPlayerControls state={state} />
        </div>
      </div>
      <div className="hidden mid-player:flex mid-player:items-center mid-player:px-2 mid-player:h-mid-player-progress-height w-full">
        <MiniPlayerProgress state={state} showTime compact />
      </div>
      <div className="hidden mid-player:flex justify-center items-center h-10 max-h-10 relative px-2">
        <div className="absolute left-2">
          <MiniPlayerLikeButton starred={state.isSongStarred} />
        </div>
        <MiniPlayerControls state={state} />
        <div className="absolute right-2">
          <MiniPlayerPopoverVolume volume={state.volume} />
        </div>
      </div>
      <ResizeHandler className="absolute w-5 h-5 bottom-0 right-0 text-foreground/50" />
    </div>
  );
}

function MiniPlayerSongImage({
  song,
  color,
  state,
}: {
  song: NonNullable<MiniPlayerState["currentSong"]>;
  color: string | null;
  state: MiniPlayerState;
}) {
  return (
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
      style={{ backgroundColor: color ?? undefined }}
    >
      <div
        className={clsx(
          "flex w-full h-full relative p-3 justify-center items-center bg-transparent",
          "mid-player:min-h-fit mid-player:max-h-full mid-player:p-0 mid-player:w-mid-player-image mid-player:h-mid-player-image",
          "mini-player:min-h-fit mini-player:max-h-full mini-player:p-0 mini-player:aspect-square",
        )}
      >
        <CachedImage
          coverArtId={song.coverArt}
          coverArtType="song"
          albumId={song.albumId}
          width="100%"
          height="100%"
          loading="eager"
          className="aspect-square object-cover object-center w-full max-h-full bg-skeleton text-transparent rounded shadow-md"
          data-testid="track-image"
          alt={`${song.artist} - ${song.title}`}
        />
        <div
          className={clsx(
            "flex flex-col w-full gap-4 absolute inset-0",
            "bg-gradient-to-b from-background/70 via-background/50 via-50% to-background to-90%",
            "opacity-0 group-hover-supported:opacity-100",
            "transition-opacity duration-300",
            "mid-player:hidden mini-player:hidden",
          )}
        >
          <div className="flex flex-col flex-1 px-2 justify-center items-center absolute inset-0">
            <MiniPlayerControls state={state} />
          </div>
          <div className="mb-auto px-2 pt-0.5">
            <MiniPlayerVolume />
          </div>
          <div className="mt-auto px-2 pb-0.5">
            <MiniPlayerProgress state={state} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniPlayerSongTitle({
  displayTitle,
  displaySubtitle,
  state,
}: {
  displayTitle: string;
  displaySubtitle: string;
  state: MiniPlayerState;
}) {
  return (
    <div className="flex flex-col flex-1 justify-center max-w-full overflow-hidden">
      <MarqueeTitle gap="mr-2">
        <span
          className={clsx(
            "text-base font-medium",
            "mid-player:text-mid-player-title mini-player:text-mini-player-title",
          )}
          data-testid="track-title"
        >
          {displayTitle}
        </span>
      </MarqueeTitle>
      <div
        className={clsx(
          "flex items-center gap-1 w-full",
          "text-xs font-normal text-foreground/70",
          "mid-player:text-mid-player-subtitle",
          "mini-player:text-[11px] mini-player:font-normal",
          "mini-player:group-hover-supported:hidden",
        )}
      >
        <MarqueeTitle gap="mr-2">
          <span className="w-fit max-w-full truncate">{displaySubtitle}</span>
        </MarqueeTitle>
      </div>
      <div className="hidden mini-player:group-hover-supported:flex w-full items-center h-4">
        <MiniPlayerProgress state={state} showTime compact />
      </div>
    </div>
  );
}

function MiniPlayerControls({ state }: { state: MiniPlayerState }) {
  const isLoopOff = state.loopState === LOOP_OFF;
  const isLoopAll = state.loopState === LOOP_ALL;
  const isLoopOne = state.loopState === LOOP_ONE;

  return (
    <div className="flex items-center">
      <Button
        size="icon"
        variant="ghost"
        data-state={state.shuffleActive && "active"}
        className={clsx(
          buttonsStyle.secondary,
          buttonsStyle.removeRing,
          state.shuffleActive && buttonsStyle.activeDot,
          "mini-player:hidden",
        )}
        style={{ ...buttonsStyle.style }}
        onClick={() => sendControlAction("toggleShuffle")}
        disabled={state.isPlaying && !state.hasNext}
        unfocusable
      >
        <Shuffle size={18} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className={clsx(
          buttonsStyle.secondary,
          buttonsStyle.removeRing,
          "mini-player:hidden",
        )}
        style={{ ...buttonsStyle.style }}
        onClick={() => sendControlAction("playPrevSong")}
        disabled={!state.hasPrev}
        unfocusable
      >
        <SkipBack className={buttonsStyle.secondaryIconFilled} width={20} />
      </Button>
      <Button
        size="icon"
        variant="link"
        className={cn(
          buttonsStyle.main,
          buttonsStyle.removeRing,
          "mini-player:w-8 mini-player:h-8",
        )}
        style={{ ...buttonsStyle.style }}
        onClick={() => sendControlAction("togglePlayPause")}
      >
        {state.isPlaying ? (
          <Pause
            className={buttonsStyle.mainIcon}
            size={20}
            strokeWidth={0.75}
            strokeLinecap="square"
            strokeLinejoin="round"
          />
        ) : (
          <Play className={buttonsStyle.mainIcon} size={18} strokeWidth={1} />
        )}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className={clsx(
          buttonsStyle.secondary,
          buttonsStyle.removeRing,
          "mini-player:w-8 mini-player:h-8",
        )}
        style={{ ...buttonsStyle.style }}
        onClick={() => sendControlAction("playNextSong")}
        disabled={!state.hasNext && state.loopState !== LOOP_ALL}
        unfocusable
      >
        <SkipForward className={buttonsStyle.secondaryIconFilled} size={20} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className={clsx(
          buttonsStyle.secondary,
          buttonsStyle.removeRing,
          !isLoopOff && buttonsStyle.activeDot,
          "mini-player:hidden",
        )}
        onClick={() => sendControlAction("toggleLoop")}
        style={{ ...buttonsStyle.style }}
        unfocusable
      >
        {isLoopOff && <Repeat size={18} />}
        {isLoopAll && <Repeat size={18} />}
        {isLoopOne && <RepeatOne size={18} />}
      </Button>
    </div>
  );
}

function MiniPlayerLikeButton({ starred }: { starred: boolean }) {
  return (
    <Button
      size="icon"
      variant="ghost"
      className={clsx(
        buttonsStyle.secondary,
        buttonsStyle.removeRing,
        "mini-player:hidden",
      )}
      onClick={() => sendControlAction("starCurrentSong")}
      style={{ ...buttonsStyle.style }}
      unfocusable
    >
      <Heart
        className={clsx(starred && "text-red-500 fill-red-500")}
        size={18}
      />
    </Button>
  );
}

function MiniPlayerProgress({
  state,
  showTime = true,
  compact = false,
}: {
  state: MiniPlayerState;
  showTime?: boolean;
  compact?: boolean;
}) {
  const [localProgress, setLocalProgress] = useState(state.progress);

  useEffect(() => {
    setLocalProgress(state.progress);
  }, [state.progress]);

  const handleSeeking = useCallback((value: number) => {
    setLocalProgress(value);
  }, []);

  const handleSeeked = useCallback((value: number) => {
    setLocalProgress(value);
    sendControlAction("seek", value);
  }, []);

  const currentTime = convertSecondsToTime(
    state.isBuffering ? 0 : localProgress,
  );
  const songDuration = convertSecondsToTime(state.duration ?? 0);
  const timeClass = compact
    ? "text-[10px] font-light tabular-nums whitespace-nowrap"
    : "min-w-[40px] text-[11px] font-light drop-shadow-md";

  return (
    <div
      className={cn(
        compact
          ? "grid grid-cols-[auto_1fr_auto] items-center gap-2 w-full"
          : "flex items-center flex-col w-full",
      )}
    >
      {showTime && compact && (
        <div className={cn(timeClass, "text-right text-foreground/70")}>
          {currentTime}
        </div>
      )}

      {showTime && !compact && (
        <div className="w-full flex justify-between text-foreground/70">
          <div className={cn(timeClass, "text-left")}>{currentTime}</div>
          <div className={cn(timeClass, "text-right")}>{songDuration}</div>
        </div>
      )}

      <Slider
        variant="secondary"
        hideThumb
        defaultValue={[0]}
        value={[localProgress]}
        max={state.duration || 1}
        step={1}
        className={cn("w-full", !compact && showTime ? "h-4" : "h-3")}
        onValueChange={([value]: number[]) => handleSeeking(value)}
        onValueCommit={([value]: number[]) => handleSeeked(value)}
      />

      {showTime && compact && (
        <div className={cn(timeClass, "text-left text-foreground/70")}>
          {songDuration}
        </div>
      )}
    </div>
  );
}

function MiniPlayerVolume() {
  return (
    <div className="flex justify-between items-center gap-2 text-foreground/70">
      <VolumeX className="w-6 h-6 drop-shadow-lg" strokeWidth={1.75} />
      <MiniPlayerVolumeSlider />
      <Volume2 className="w-6 h-6 drop-shadow-lg" strokeWidth={1.75} />
    </div>
  );
}

function MiniPlayerVolumeSlider() {
  const [volume, setVolume] = useState(100);

  const handleChange = useCallback(([value]: number[]) => {
    setVolume(value);
    sendControlAction("setVolume", value / 100);
  }, []);

  return (
    <Slider
      variant="secondary"
      className="w-full"
      defaultValue={[volume]}
      max={100}
      step={1}
      onValueChange={handleChange}
      onValueCommit={handleChange}
    />
  );
}

function MiniPlayerPopoverVolume({ volume }: { volume: number }) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          className="rounded-full w-10 h-10 p-2 text-secondary-foreground data-[state=open]:bg-accent"
          unfocusable
        >
          <Volume2 size={14} />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Content
        className={cn(
          "z-50 w-fit h-10 px-4 py-0 flex items-center rounded-full",
          "bg-popover border text-popover-foreground shadow-md outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        )}
        side="top"
        align="center"
        sideOffset={4}
      >
        <VolumeX size={14} strokeWidth={1.75} />
        <Slider
          variant="secondary"
          className="w-24"
          defaultValue={[volume * 100]}
          max={100}
          step={1}
          onValueCommit={([value]: number[]) =>
            sendControlAction("setVolume", value / 100)
          }
        />
        <Volume2 size={14} strokeWidth={1.75} />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  );
}

export default function MiniPlayerPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInitializer />
      <MiniPlayerPageContent />
    </QueryClientProvider>
  );
}
