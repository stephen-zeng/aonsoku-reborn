import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { subsonic } from "@/service/subsonic";
import { useIsOnline } from "@/store/cache.store";
import { usePlayerSonglist } from "@/store/player.store";
import { areLyricsSynced } from "@/utils/lrc-converter";
import { queryKeys } from "@/utils/queryKeys";

const STALE_TIME = 5 * 60 * 1000;

export function useHasLyrics() {
  const { currentSong } = usePlayerSonglist();
  const { id: songId, artist, title, duration } = currentSong;
  const isOnline = useIsOnline();

  const { data: lyrics, isLoading: isLoadingLyrics } = useQuery({
    queryKey: [...queryKeys.lyrics.plain, artist, title, duration],
    queryFn: () => subsonic.lyrics.getLyrics({ artist, title, duration }),
    enabled: isOnline,
    staleTime: STALE_TIME,
  });

  const { data: structuredLyrics, isLoading: isLoadingStructured } = useQuery({
    queryKey: [...queryKeys.lyrics.structured, songId],
    queryFn: () => subsonic.lyrics.getStructuredLyrics(songId),
    enabled: !!songId,
    staleTime: STALE_TIME,
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
