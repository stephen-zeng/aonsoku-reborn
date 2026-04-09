import { metadataCache, type SyncMeta } from "@/lib/cache/metadata-cache";
import { queryClient } from "@/lib/queryClient";
import type { Albums, AlbumsListData } from "@/types/responses/album";
import { queryKeys } from "@/utils/queryKeys";

function pickRandom<T>(arr: T[], k: number): T[] {
  const copy = [...arr];
  const end = Math.min(k, copy.length);
  for (let i = 0; i < end; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, end);
}

function dateMs(s: string | undefined): number {
  if (!s) return 0;
  return new Date(s).getTime() || 0;
}

export async function hydrateFromSyncCache(
  meta?: SyncMeta | null,
): Promise<void> {
  const resolvedMeta = meta ?? (await metadataCache.getMeta());
  if (!resolvedMeta) return;

  const [albums, artists, songs] = await Promise.all([
    metadataCache.getAlbums(),
    metadataCache.getArtists(),
    metadataCache.getSongs(),
  ]);

  // Artists list page
  queryClient.setQueryData([queryKeys.artist.all], artists);

  // Song count (from meta, avoids iterating songs array)
  queryClient.setQueryData(
    [queryKeys.song.count],
    resolvedMeta.songCount,
  );

  // Home page sections
  const toAlbumList = (list: Albums[]): AlbumsListData => ({
    albumsCount: list.length,
    list,
  });

  // Recently added (sorted by created date desc)
  const byNewest = [...albums].sort(
    (a, b) => dateMs(b.created) - dateMs(a.created),
  );
  queryClient.setQueryData(
    [queryKeys.album.recentlyAdded],
    toAlbumList(byNewest.slice(0, 16)),
  );

  // Most played (sorted by playCount desc)
  const byFrequent = [...albums].sort(
    (a, b) => (b.playCount ?? 0) - (a.playCount ?? 0),
  );
  queryClient.setQueryData(
    [queryKeys.album.mostPlayed],
    toAlbumList(byFrequent.slice(0, 16)),
  );

  // Recently played (sorted by played date desc)
  const byRecent = albums
    .filter((a) => a.played)
    .sort((a, b) => dateMs(b.played) - dateMs(a.played));
  queryClient.setQueryData(
    [queryKeys.album.recentlyPlayed],
    toAlbumList(byRecent.slice(0, 16)),
  );

  // Random albums (partial Fisher-Yates)
  queryClient.setQueryData(
    [queryKeys.album.random],
    toAlbumList(pickRandom(albums, 16)),
  );

  // Random songs — home header (partial Fisher-Yates)
  queryClient.setQueryData(
    [queryKeys.song.random],
    pickRandom(songs, 10),
  );
}
