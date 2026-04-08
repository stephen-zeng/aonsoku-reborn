import { LyricPlayer } from "@applemusic-like-lyrics/react";
import type { LyricPlayerRef } from "@applemusic-like-lyrics/react";
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
  usePlayerIsPlaying,
  usePlayerRef,
  usePlayerSonglist,
} from "@/store/player.store";
import { ILyric } from "@/types/responses/song";
import {
  areLyricsSynced,
  convertLrcToAMLL,
  LRC_METADATA_REGEX,
  LRC_TIMESTAMP_REGEX,
} from "@/utils/lrc-converter";

interface LyricProps {
  lyrics: ILyric;
  songDurationMs?: number;
}

export function LyricsTab() {
  const { currentSong } = usePlayerSonglist();
  const { t } = useTranslation();

  const { artist, title, duration } = currentSong;

  const { data: lyrics, isLoading } = useQuery({
    queryKey: ["get-lyrics", artist, title, duration],
    queryFn: () =>
      subsonic.lyrics.getLyrics({
        artist,
        title,
        duration,
      }),
  });

  const noLyricsFound = t("fullscreen.noLyrics");
  const loadingLyrics = t("fullscreen.loadingLyrics");

  if (isLoading) {
    return <CenteredMessage>{loadingLyrics}</CenteredMessage>;
  } else if (lyrics && lyrics.value) {
    const songDurationMs = duration ? duration * 1000 : undefined;
    return areLyricsSynced(lyrics.value) ? (
      <SyncedLyrics lyrics={lyrics} songDurationMs={songDurationMs} />
    ) : (
      <UnsyncedLyrics lyrics={lyrics} />
    );
  } else {
    return <CenteredMessage>{noLyricsFound}</CenteredMessage>;
  }
}

function SyncedLyrics({ lyrics, songDurationMs }: LyricProps) {
  const playerRef = usePlayerRef();
  const isPlaying = usePlayerIsPlaying();
  const [currentTime, setCurrentTime] = useState(0);
  const animationFrameRef = useRef<number>();
  const lyricPlayerRef = useRef<LyricPlayerRef>(null);
  const seekingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Convert LRC to AMLL format
  const lyricLines = useMemo(() => {
    if (!lyrics.value) return [];
    return convertLrcToAMLL(lyrics.value, songDurationMs);
  }, [lyrics.value, songDurationMs]);

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
    <div className="w-full h-full text-center lrc-box">
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
        alignAnchor="center"
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

              // Prepare AMLL for seek: prevent cascade animation
              // jitter on large time jumps
              const lp = lyricPlayerRef.current?.lyricPlayer;
              if (lp) {
                lp.resetScroll();
                lp.setIsSeeking(true);
                clearTimeout(seekingTimerRef.current);
                seekingTimerRef.current = setTimeout(() => {
                  lp.setIsSeeking(false);
                }, 100);
              }

              // Update time state immediately with exact target to
              // avoid a conflicting RAF update with a rounded value
              setCurrentTime(lyricLine.startTime);
            }
          }
        }}
      />
    </div>
  );
}

function cleanUnsyncedLyrics(raw: string): string[] {
  return raw
    .split("\n")
    .filter((line) => !LRC_METADATA_REGEX.test(line))
    .map((line) => line.replace(LRC_TIMESTAMP_REGEX, "").trim())
    .filter((line) => line.length > 0);
}

function UnsyncedLyrics({ lyrics }: LyricProps) {
  const { currentSong } = usePlayerSonglist();
  const lyricsBoxRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(
    () => cleanUnsyncedLyrics(lyrics.value!),
    [lyrics.value],
  );

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
      className="w-full h-full overflow-y-auto text-center font-semibold text-xl 2xl:text-2xl px-2 scroll-smooth"
      thumbClassName="secondary-thumb-bar"
      ref={lyricsBoxRef}
    >
      {lines.map((line, index) => (
        <p
          key={index}
          className={clsx(
            "leading-10 drop-shadow-lg text-balance",
            index === 0 && "mt-6",
            index === lines.length - 1 && "mb-10",
          )}
        >
          {line}
        </p>
      ))}
    </ScrollArea>
  );
}

type CenteredMessageProps = ComponentPropsWithoutRef<"p">;

function CenteredMessage({ children }: CenteredMessageProps) {
  return (
    <div className="w-full h-full flex justify-center items-center">
      <p className="leading-10 drop-shadow-lg text-center font-semibold text-xl 2xl:text-2xl">
        {children}
      </p>
    </div>
  );
}
