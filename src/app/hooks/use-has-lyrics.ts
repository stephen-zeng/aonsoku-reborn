import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePlayerSonglist } from "@/store/player.store";
import { subsonic } from "@/service/subsonic";
import { areLyricsSynced } from "@/utils/lrc-converter";

export function useHasLyrics() {
  const { currentSong } = usePlayerSonglist();
  const { id: songId, artist, title, duration } = currentSong;

  const { data: lyrics, isLoading: isLoadingLyrics } = useQuery({
    queryKey: ["get-lyrics", artist, title, duration],
    queryFn: () => subsonic.lyrics.getLyrics({ artist, title, duration }),
  });

  const { data: structuredLyrics, isLoading: isLoadingStructured } = useQuery({
    queryKey: ["get-structured-lyrics", songId],
    queryFn: () => subsonic.lyrics.getStructuredLyrics(songId),
    enabled: !!songId,
  });

  const hasLyrics = useMemo(() => {
    if (isLoadingLyrics || isLoadingStructured) return undefined;

    if (structuredLyrics && structuredLyrics.length > 0) return true;
    if (lyrics?.value) {
      if (areLyricsSynced(lyrics.value)) return true;
      const plainLines = lyrics.value
        .split("\n")
        .filter((l) => l.trim().length > 0);
      return plainLines.length > 0;
    }

    return false;
  }, [structuredLyrics, lyrics, isLoadingLyrics, isLoadingStructured]);

  return { hasLyrics };
}
