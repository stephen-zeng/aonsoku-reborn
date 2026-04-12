import type { LyricLine } from "@applemusic-like-lyrics/core";
import type { LyricPlayerRef } from "@applemusic-like-lyrics/react";
import { LyricPlayer } from "@applemusic-like-lyrics/react";
import "@applemusic-like-lyrics/core/style.css";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ComponentPropsWithoutRef,
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
  const animationFrameRef = useRef<number>();
  const lyricPlayerRef = useRef<LyricPlayerRef>(null);
  const seekingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Use requestAnimationFrame for smooth time updates
  useEffect(() => {
    if (!playerRef) return;

    const updateTime = () => {
      const timeMs = Math.floor((playerRef.currentTime || 0) * 1000);
      setCurrentTime((prev) => (prev === timeMs ? prev : timeMs));
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clearTimeout(seekingTimerRef.current);
    };
  }, [playerRef]);

  return (
    <div className="w-full h-full text-left lrc-box" data-vaul-no-drag>
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
        enableBlur={true}
        enableSpring={true}
        onLyricLineClick={(line) => {
          if (
            playerRef &&
            line.lineIndex !== undefined &&
            lyricLines[line.lineIndex]
          ) {
            const lyricLine = lyricLines[line.lineIndex];
            if (Number.isFinite(lyricLine.startTime)) {
              // Seek the audio element
              playerRef.currentTime = lyricLine.startTime / 1000;
              if (isPlaying) {
                playerRef.play().catch(() => {});
              }

              // Prepare AMLL for seek: prevent cascade
              // animation jitter on large time jumps
              const lp = lyricPlayerRef.current?.lyricPlayer;
              if (lp) {
                lp.resetScroll();
                lp.setIsSeeking(true);
                clearTimeout(seekingTimerRef.current);
                seekingTimerRef.current = setTimeout(() => {
                  lp.setIsSeeking(false);
                }, 100);
              }

              // Update time state immediately with exact
              // target to avoid a conflicting RAF update
              // with a rounded value
              setCurrentTime(lyricLine.startTime);
            }
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
