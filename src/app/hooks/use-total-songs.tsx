import { useQuery } from "@tanstack/react-query";
import { metadataCache } from "@/lib/cache/metadata-cache";
import { readOfflineCapable } from "@/lib/offline/read-model";
import { subsonic } from "@/service/subsonic";
import { useAppStore } from "@/store/app.store";
import { convertMinutesToMs } from "@/utils/convertSecondsToTime";
import { queryKeys } from "@/utils/queryKeys";

async function fetchSongs(offset: number, count: number) {
  const response = await subsonic.search.get({
    artistCount: 0,
    albumCount: 0,
    songCount: count,
    songOffset: offset,
  });
  return response?.song ?? [];
}

async function fetchTotalSongsOnline(): Promise<number> {
  const storedSongCount = useAppStore.getState().data.songCount;

  if (storedSongCount && storedSongCount > 0) {
    return storedSongCount;
  }

  const songCount = 100;
  let lowerBound = 0;
  let upperBound = songCount;

  while (true) {
    const songs = await fetchSongs(upperBound, songCount);

    if (songs.length < songCount) {
      break;
    } else {
      lowerBound = upperBound;
      upperBound *= 2;
    }
  }

  let totalSongs = lowerBound;

  while (lowerBound < upperBound) {
    const midPoint = Math.floor((lowerBound + upperBound) / 2);
    const songs = await fetchSongs(midPoint, songCount);

    if (songs.length < songCount) {
      upperBound = midPoint;
    } else {
      lowerBound = midPoint + songCount;
    }

    totalSongs = upperBound;
  }

  const songs = await fetchSongs(totalSongs, songCount);
  if (songs.length > 0) {
    totalSongs += songs.length;
  }

  useAppStore.setState((state) => {
    state.data.songCount = totalSongs;
  });

  return totalSongs;
}

async function fetchTotalSongs(): Promise<number> {
  return readOfflineCapable(fetchTotalSongsOnline, async () => {
    const meta = await metadataCache.getMeta();
    return meta?.songCount ?? 0;
  });
}

export function useTotalSongs() {
  return useQuery({
    queryKey: [queryKeys.song.count],
    queryFn: fetchTotalSongs,
    staleTime: convertMinutesToMs(5),
    gcTime: convertMinutesToMs(5),
  });
}
