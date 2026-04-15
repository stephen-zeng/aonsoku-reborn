import type { LyricLine } from "@applemusic-like-lyrics/core";
import type { LyricPlayerRef } from "@applemusic-like-lyrics/react";
import { LyricPlayer } from "@applemusic-like-lyrics/react";
import "@applemusic-like-lyrics/core/style.css";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ComponentPropsWithoutRef,
  TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollArea,
  scrollAreaViewportSelector,
} from "@/app/components/ui/scroll-area";
import { subsonic } from "@/service/subsonic";
import {
  useLyricsSettings,
  usePlayerIsPlaying,
  usePlayerRef,
  usePlayerSonglist,
} from "@/store/player.store";
import type { IStructuredLyric } from "@/types/responses/song";
import {
  areLyricsSynced,
  convertLrcToAMLL,
  convertStructuredToAMLL,
  LRC_METADATA_REGEX,
  LRC_TIMESTAMP_REGEX,
} from "@/utils/lrc-converter";

type ResolvedSynced = {
  type: "synced";
  lyricLines: LyricLine[];
};

type ResolvedUnsynced = {
  type: "unsynced";
  lines: string[];
  translationLines?: string[];
};

type ResolvedLyrics = ResolvedSynced | ResolvedUnsynced;

type InternalLyricLineObject = {
  getElement(): HTMLElement;
};

type InternalLyricPlayerHandle = {
  getElement(): HTMLElement;
  resetScroll(): void;
  setIsSeeking(isSeeking: boolean): void;
  alignAnchor?: "top" | "center" | "bottom" | string;
  alignPosition?: number;
  currentLyricLineObjects?: InternalLyricLineObject[];
  lyricLineElementMap?: WeakMap<HTMLElement, InternalLyricLineObject>;
  lyricLinesIndexes?: WeakMap<InternalLyricLineObject, number>;
  size?: [number, number];
  targetAlignIndex?: number;
};

type TouchTapState = {
  moved: boolean;
  startedAt: number;
  target: EventTarget | null;
  x: number;
  y: number;
};

const LYRIC_TAP_MAX_DISTANCE_PX = 10;
const LYRIC_TAP_MAX_DURATION_MS = 250;
const LYRIC_SEEK_DEDUP_MS = 400;
const LYRIC_ALIGN_RESTORE_THRESHOLD_PX = 6;
const LYRIC_TOUCH_SCROLL_BLUR_RESET_MS = 5000;

function resolveLyricLineIndexFromTarget(
  player: InternalLyricPlayerHandle | undefined,
  target: EventTarget | null,
): number | null {
  if (!(target instanceof Node) || !player) return null;

  const playerElement = player.getElement();
  let currentNode: Node | null = target;

  while (currentNode && currentNode !== playerElement) {
    if (
      currentNode instanceof HTMLElement &&
      currentNode.parentElement === playerElement
    ) {
      const lyricLine = player.lyricLineElementMap?.get(currentNode);
      if (!lyricLine) return null;

      const lineIndex = player.lyricLinesIndexes?.get(lyricLine);
      return typeof lineIndex === "number" ? lineIndex : null;
    }

    currentNode = currentNode.parentNode;
  }

  return null;
}

function isLyricPlayerAligned(
  player: InternalLyricPlayerHandle | undefined,
): boolean {
  if (!player) return false;

  const playerElement = player.getElement();
  const targetAlignIndex = player.targetAlignIndex;
  const targetLine =
    typeof targetAlignIndex === "number"
      ? player.currentLyricLineObjects?.[targetAlignIndex]
      : undefined;

  if (!targetLine || !playerElement.isConnected) {
    return false;
  }

  const lineElement = targetLine.getElement();
  if (!lineElement.isConnected) {
    return false;
  }

  const playerRect = playerElement.getBoundingClientRect();
  const lineRect = lineElement.getBoundingClientRect();
  const playerHeight = player.size?.[1] ?? playerElement.clientHeight;
  const alignPosition = player.alignPosition ?? 0.35;

  let offset = lineRect.top - playerRect.top - playerHeight * alignPosition;

  switch (player.alignAnchor) {
    case "bottom":
      offset += lineElement.clientHeight;
      break;
    case "center":
      offset += lineElement.clientHeight / 2;
      break;
  }

  return Math.abs(offset) <= LYRIC_ALIGN_RESTORE_THRESHOLD_PX;
}

function getInternalLyricPlayer(
  playerRef: React.RefObject<LyricPlayerRef | null>,
): InternalLyricPlayerHandle | undefined {
  return playerRef.current?.lyricPlayer as
    | InternalLyricPlayerHandle
    | undefined;
}

function cleanUnsyncedLyrics(raw: string): string[] {
  return raw
    .split("\n")
    .filter((line) => !LRC_METADATA_REGEX.test(line))
    .map((line) => line.replace(LRC_TIMESTAMP_REGEX, "").trim())
    .filter((line) => line.length > 0);
}

/**
 * Pick the primary and (optional) translation tracks from
 * structured lyrics. The first entry is the primary; the
 * second entry (if present) is the translation.
 */
function pickStructuredTracks(structured: IStructuredLyric[]): {
  primary: IStructuredLyric;
  translation?: IStructuredLyric;
} {
  const primary = structured[0];
  const translation = structured.length >= 2 ? structured[1] : undefined;
  return { primary, translation };
}

export function LyricsTab() {
  const { currentSong } = usePlayerSonglist();
  const { t } = useTranslation();
  const { showTranslation } = useLyricsSettings();

  const { id: songId, artist, title, duration } = currentSong;
  const songDurationMs = duration ? duration * 1000 : undefined;

  const { data: lyrics, isLoading: isLoadingLyrics } = useQuery({
    queryKey: ["get-lyrics", artist, title, duration],
    queryFn: () => subsonic.lyrics.getLyrics({ artist, title, duration }),
  });

  const { data: structuredLyrics, isLoading: isLoadingStructured } = useQuery({
    queryKey: ["get-structured-lyrics", songId],
    queryFn: () => subsonic.lyrics.getStructuredLyrics(songId),
    enabled: !!songId,
  });

  // Resolve the best lyrics source into a render-ready format.
  // Priority: structured (synced) > structured (unsynced)
  //           > /getLyrics (LRC) > /getLyrics (plain)
  const resolved: ResolvedLyrics | null = useMemo(() => {
    // Priority 1 & 2: Structured lyrics
    if (structuredLyrics && structuredLyrics.length > 0) {
      const { primary, translation } = pickStructuredTracks(structuredLyrics);

      if (primary.synced) {
        // Priority 1: Structured + synced
        const lyricLines = convertStructuredToAMLL(
          primary,
          translation,
          songDurationMs,
        );
        return {
          type: "synced",
          lyricLines: showTranslation
            ? lyricLines
            : lyricLines.map((l) => ({
                ...l,
                translatedLyric: "",
              })),
        };
      }

      // Priority 2: Structured but unsynced
      const mainLines = primary.line.map((l) => l.value);
      const translationLines = showTranslation
        ? translation?.line.map((l) => l.value)
        : undefined;
      return {
        type: "unsynced",
        lines: mainLines,
        translationLines,
      };
    }

    // Priority 3 & 4: /getLyrics result
    if (lyrics?.value) {
      if (areLyricsSynced(lyrics.value)) {
        // Priority 3: LRC synced
        return {
          type: "synced",
          lyricLines: convertLrcToAMLL(lyrics.value, songDurationMs),
        };
      }

      // Priority 4: Plain text
      return {
        type: "unsynced",
        lines: cleanUnsyncedLyrics(lyrics.value),
      };
    }

    return null;
  }, [structuredLyrics, lyrics, showTranslation, songDurationMs]);

  const noLyricsFound = t("fullscreen.noLyrics");
  const loadingLyrics = t("fullscreen.loadingLyrics");

  if (isLoadingLyrics && isLoadingStructured) {
    return <CenteredMessage>{loadingLyrics}</CenteredMessage>;
  }

  if (!resolved) {
    return <CenteredMessage>{noLyricsFound}</CenteredMessage>;
  }

  if (resolved.type === "synced") {
    return <SyncedLyrics lyricLines={resolved.lyricLines} />;
  }

  return (
    <UnsyncedLyrics
      lines={resolved.lines}
      translationLines={resolved.translationLines}
    />
  );
}

interface SyncedLyricsProps {
  lyricLines: LyricLine[];
}

function SyncedLyrics({ lyricLines }: SyncedLyricsProps) {
  const playerRef = usePlayerRef();
  const isPlaying = usePlayerIsPlaying();
  const [currentTime, setCurrentTime] = useState(0);
  const [isTouchScrolling, setIsTouchScrolling] = useState(false);
  const animationFrameRef = useRef<number>();
  const isTouchScrollingRef = useRef(false);
  const lyricPlayerRef = useRef<LyricPlayerRef>(null);
  const seekingTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const touchScrollBlurTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastManualSeekRef = useRef<{
    lineIndex: number;
    timestamp: number;
  } | null>(null);
  const touchTapStateRef = useRef<TouchTapState | null>(null);

  const clearTouchScrollBlurTimer = useCallback(() => {
    clearTimeout(touchScrollBlurTimerRef.current);
  }, []);

  const setTouchScrolling = useCallback((next: boolean) => {
    isTouchScrollingRef.current = next;
    setIsTouchScrolling((prev) => (prev === next ? prev : next));
  }, []);

  const scheduleTouchScrollBlurRestore = useCallback(() => {
    clearTouchScrollBlurTimer();
    touchScrollBlurTimerRef.current = setTimeout(() => {
      setTouchScrolling(false);
    }, LYRIC_TOUCH_SCROLL_BLUR_RESET_MS);
  }, [clearTouchScrollBlurTimer, setTouchScrolling]);

  const seekToLyricLine = useCallback(
    (lineIndex: number) => {
      const lyricLine = lyricLines[lineIndex];

      if (!playerRef || !lyricLine || !Number.isFinite(lyricLine.startTime)) {
        return;
      }

      const now = Date.now();
      const lastManualSeek = lastManualSeekRef.current;

      if (
        lastManualSeek &&
        lastManualSeek.lineIndex === lineIndex &&
        now - lastManualSeek.timestamp < LYRIC_SEEK_DEDUP_MS
      ) {
        return;
      }

      lastManualSeekRef.current = {
        lineIndex,
        timestamp: now,
      };

      playerRef.currentTime = lyricLine.startTime / 1000;
      if (isPlaying) {
        playerRef.play().catch(() => {});
      }

      const player = getInternalLyricPlayer(lyricPlayerRef);
      if (player) {
        player.resetScroll();
        player.setIsSeeking(true);
        clearTimeout(seekingTimerRef.current);
        seekingTimerRef.current = setTimeout(() => {
          player.setIsSeeking(false);
        }, 100);
      }

      setCurrentTime(lyricLine.startTime);
    },
    [isPlaying, lyricLines, playerRef],
  );

  const handleTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      clearTouchScrollBlurTimer();

      if (event.touches.length !== 1) {
        touchTapStateRef.current = null;
        return;
      }

      const touch = event.touches[0];
      touchTapStateRef.current = {
        moved: false,
        startedAt: Date.now(),
        target: event.target,
        x: touch.clientX,
        y: touch.clientY,
      };
    },
    [clearTouchScrollBlurTimer],
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const touchTapState = touchTapStateRef.current;

      if (!touchTapState || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const movedX = Math.abs(touch.clientX - touchTapState.x);
      const movedY = Math.abs(touch.clientY - touchTapState.y);

      if (
        !touchTapState.moved &&
        (movedX > LYRIC_TAP_MAX_DISTANCE_PX ||
          movedY > LYRIC_TAP_MAX_DISTANCE_PX)
      ) {
        touchTapState.moved = true;
        setTouchScrolling(true);
      }
    },
    [setTouchScrolling],
  );

  const handleTouchEnd = useCallback(() => {
    const touchTapState = touchTapStateRef.current;
    touchTapStateRef.current = null;

    if (!touchTapState) return;

    if (touchTapState.moved) {
      scheduleTouchScrollBlurRestore();
      return;
    }

    if (Date.now() - touchTapState.startedAt > LYRIC_TAP_MAX_DURATION_MS) {
      return;
    }

    const player = getInternalLyricPlayer(lyricPlayerRef);
    const lineIndex = resolveLyricLineIndexFromTarget(
      player,
      touchTapState.target,
    );

    if (lineIndex !== null) {
      seekToLyricLine(lineIndex);
    }
  }, [scheduleTouchScrollBlurRestore, seekToLyricLine]);

  const handleTouchCancel = useCallback(() => {
    if (touchTapStateRef.current?.moved || isTouchScrollingRef.current) {
      scheduleTouchScrollBlurRestore();
    }

    touchTapStateRef.current = null;
  }, [scheduleTouchScrollBlurRestore]);

  // Use requestAnimationFrame for smooth time updates
  useEffect(() => {
    if (!playerRef) return;

    const updateTime = () => {
      const timeMs = Math.floor((playerRef.currentTime || 0) * 1000);
      setCurrentTime((prev) => (prev === timeMs ? prev : timeMs));

      const player = getInternalLyricPlayer(lyricPlayerRef);
      if (
        isTouchScrollingRef.current &&
        !touchTapStateRef.current &&
        isLyricPlayerAligned(player)
      ) {
        clearTouchScrollBlurTimer();
        setTouchScrolling(false);
      }

      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clearTimeout(seekingTimerRef.current);
      clearTouchScrollBlurTimer();
    };
  }, [clearTouchScrollBlurTimer, playerRef, setTouchScrolling]);

  return (
    <div
      className="w-full h-full text-left lrc-box"
      data-vaul-no-drag
      onClick={(e) => e.stopPropagation()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <LyricPlayer
        ref={lyricPlayerRef}
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          contain: "paint layout",
          overflow: "hidden",
        }}
        lyricLines={lyricLines}
        currentTime={currentTime}
        alignAnchor="left"
        enableBlur={!isTouchScrolling}
        enableSpring={true}
        onLyricLineClick={(line) => {
          if (line.lineIndex !== undefined) {
            seekToLyricLine(line.lineIndex);
          }
        }}
      />
    </div>
  );
}

interface UnsyncedLyricsProps {
  lines: string[];
  translationLines?: string[];
}

function UnsyncedLyrics({ lines, translationLines }: UnsyncedLyricsProps) {
  const { currentSong } = usePlayerSonglist();
  const lyricsBoxRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: recomputed when song changes
  useEffect(() => {
    if (lyricsBoxRef.current) {
      const scrollArea = lyricsBoxRef.current.querySelector(
        scrollAreaViewportSelector,
      ) as HTMLDivElement | null;

      scrollArea?.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }, [currentSong]);

  return (
    <ScrollArea
      type="always"
      className="w-full h-full overflow-y-auto text-left font-semibold text-xl 2xl:text-2xl px-2 scroll-smooth"
      thumbClassName="secondary-thumb-bar"
      ref={lyricsBoxRef}
      data-vaul-no-drag
    >
      {lines.map((line, index) => (
        <div
          key={index}
          className={clsx(
            index === 0 && "mt-6",
            index === lines.length - 1 && "mb-10",
          )}
        >
          <p className="leading-10 text-balance">{line}</p>
          {translationLines?.[index] && (
            <p className="leading-8 text-balance text-base 2xl:text-lg opacity-70">
              {translationLines[index]}
            </p>
          )}
        </div>
      ))}
    </ScrollArea>
  );
}

type CenteredMessageProps = ComponentPropsWithoutRef<"p">;

function CenteredMessage({ children }: CenteredMessageProps) {
  return (
    <div className="w-full h-full flex justify-center items-center">
      <p className="leading-10 text-left font-semibold text-xl 2xl:text-2xl">
        {children}
      </p>
    </div>
  );
}
