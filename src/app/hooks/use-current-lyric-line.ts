import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subsonic } from "@/service/subsonic";
import { useIsOnline } from "@/store/cache.store";
import {
  usePlayerCurrentSong,
  usePlayerIsPlaying,
  usePlayerRef,
} from "@/store/player.store";
import type { IStructuredLyric } from "@/types/responses/song";
import {
  areLyricsSynced,
  convertLrcToAMLL,
  convertStructuredToAMLL,
} from "@/utils/lrc-converter";
import { queryKeys } from "@/utils/queryKeys";

const STALE_TIME = 5 * 60 * 1000;

interface SyncedLine {
  startTime: number;
  endTime: number;
  text: string;
}

function extractSyncedLinesFromStructured(
  structured: IStructuredLyric[],
  songDurationMs?: number,
): SyncedLine[] {
  const synced = structured.find((s) => s.synced);
  if (!synced) return [];

  const amlLines = convertStructuredToAMLL(synced, undefined, songDurationMs);
  return amlLines.map((l) => ({
    startTime: l.startTime,
    endTime: l.endTime,
    text: l.words.map((w) => w.word).join(""),
  }));
}

function extractSyncedLinesFromLrc(
  lrc: string,
  songDurationMs?: number,
): SyncedLine[] {
  const lines = convertLrcToAMLL(lrc, songDurationMs);
  return lines.map((line) => ({
    startTime: line.startTime,
    endTime: line.endTime,
    text: line.words.map((w) => w.word).join(""),
  }));
}

function findCurrentLine(
  lines: SyncedLine[],
  currentTimeMs: number,
): string | null {
  for (const line of lines) {
    if (currentTimeMs >= line.startTime && currentTimeMs < line.endTime) {
      return line.text || null;
    }
  }
  return null;
}

export function useCurrentLyricLine() {
  const currentSong = usePlayerCurrentSong();
  const playerRef = usePlayerRef();
  const isOnline = useIsOnline();
  const isPlaying = usePlayerIsPlaying();

  const { id: songId, artist, title, duration } = currentSong || {};
  const songDurationMs = duration ? duration * 1000 : undefined;

  const { data: lyrics } = useQuery({
    queryKey: [...queryKeys.lyrics.plain, artist, title, duration],
    queryFn: () =>
      artist && title
        ? subsonic.lyrics.getLyrics({ artist, title, duration })
        : Promise.resolve(null),
    enabled: isOnline && !!artist && !!title,
    staleTime: STALE_TIME,
  });

  const { data: structuredLyrics } = useQuery({
    queryKey: [...queryKeys.lyrics.structured, songId],
    queryFn: () =>
      songId
        ? subsonic.lyrics.getStructuredLyrics(songId)
        : Promise.resolve([]),
    enabled: !!songId,
    staleTime: STALE_TIME,
  });

  const syncedLines = useMemo((): SyncedLine[] => {
    if (!currentSong) return [];

    if (structuredLyrics && structuredLyrics.length > 0) {
      const lines = extractSyncedLinesFromStructured(
        structuredLyrics,
        songDurationMs,
      );
      if (lines.length > 0) return lines;
    }

    if (lyrics?.value && areLyricsSynced(lyrics.value)) {
      return extractSyncedLinesFromLrc(lyrics.value, songDurationMs);
    }

    return [];
  }, [structuredLyrics, lyrics, currentSong, songDurationMs]);

  const [currentLine, setCurrentLine] = useState<string | null>(null);
  const animationFrameRef = useRef<number>();
  const lastLineRef = useRef<string | null>(null);
  const syncedLinesRef = useRef(syncedLines);
  syncedLinesRef.current = syncedLines;

  const tick = useCallback(() => {
    if (!playerRef) return;

    const lines = syncedLinesRef.current;
    if (lines.length === 0) {
      if (lastLineRef.current !== null) {
        lastLineRef.current = null;
        setCurrentLine(null);
      }
      return;
    }

    const timeMs = Math.floor((playerRef.currentTime || 0) * 1000);
    const line = findCurrentLine(lines, timeMs);
    if (line !== lastLineRef.current) {
      lastLineRef.current = line;
      setCurrentLine(line);
    }

    animationFrameRef.current = requestAnimationFrame(tick);
  }, [playerRef]);

  useEffect(() => {
    if (!isPlaying || syncedLines.length === 0) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      return;
    }

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, syncedLines.length, tick]);

  // Set initial line position when paused with synced lyrics available
  useEffect(() => {
    if (isPlaying || !playerRef || syncedLines.length === 0) return;

    const timeMs = Math.floor((playerRef.currentTime || 0) * 1000);
    const line = findCurrentLine(syncedLines, timeMs);
    if (line !== lastLineRef.current) {
      lastLineRef.current = line;
      setCurrentLine(line);
    }
  }, [isPlaying, playerRef, syncedLines]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on song change
  useEffect(() => {
    lastLineRef.current = null;
    setCurrentLine(null);
  }, [songId]);

  return { currentLine };
}
