import type { LyricLine, LyricWord } from "@applemusic-like-lyrics/core";

/**
 * Parse LRC timestamp to milliseconds
 * Supports formats: [mm:ss.xx], [mm:ss.xxx], [mm:ss:xx]
 */
function parseTimestamp(timestamp: string): number {
  // Handle both [mm:ss.xx] and [mm:ss:xx] formats
  const match = timestamp.match(/\[(\d+):(\d+)[.:](\d+)\]/);
  if (!match) return 0;

  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  let milliseconds = parseInt(match[3], 10);

  // Handle different decimal precisions
  if (match[3].length === 2) {
    // centiseconds (e.g. .50 = 500ms)
    milliseconds *= 10;
  } else if (match[3].length === 1) {
    // deciseconds (e.g. .5 = 500ms)
    milliseconds *= 100;
  }
  // length 3 is already milliseconds

  return minutes * 60 * 1000 + seconds * 1000 + milliseconds;
}

/**
 * Parse a single LRC line and extract timestamp and content
 */
function parseLrcLine(
  line: string,
): { timestamp: number; content: string } | null {
  // Match LRC format: [mm:ss.xx] or [mm:ss:xx] followed by content
  const match = line.match(/^\[(\d+:\d+[.:]\d+)\](.*)$/);
  if (!match) return null;

  const timestamp = parseTimestamp(`[${match[1]}]`);
  const content = match[2].trim();

  return { timestamp, content };
}

/**
 * Convert LRC format lyrics to AMLL LyricLine[] format
 */
export function convertLrcToAMLL(lrcContent: string): LyricLine[] {
  const lines = lrcContent.split("\n");
  const parsedLines: { timestamp: number; content: string }[] = [];

  // Parse all lines with timestamps
  for (const line of lines) {
    const parsed = parseLrcLine(line);
    if (parsed && parsed.content) {
      parsedLines.push(parsed);
    }
  }

  // Sort by timestamp
  parsedLines.sort((a, b) => a.timestamp - b.timestamp);

  // Convert to AMLL format
  return parsedLines.map((line, index, arr): LyricLine => {
    // Calculate end time based on next line's start time
    const endTime =
      index < arr.length - 1 ? arr[index + 1].timestamp : line.timestamp + 5000;

    const word: LyricWord = {
      word: line.content,
      startTime: line.timestamp,
      endTime: endTime,
      romanWord: "",
      obscene: false,
    };

    return {
      words: [word],
      startTime: line.timestamp,
      endTime: endTime,
      translatedLyric: "",
      romanLyric: "",
      isBG: false,
      isDuet: false,
    };
  });
}

/**
 * Check if lyrics are synced (have LRC timestamps)
 */
export function areLyricsSynced(lyrics: string): boolean {
  const lyric = lyrics.trim();
  return (
    lyric.startsWith("[00:") ||
    lyric.startsWith("[01:") ||
    lyric.startsWith("[02:")
  );
}
