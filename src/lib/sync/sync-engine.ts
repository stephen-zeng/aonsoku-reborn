import { getCoverArtUrl } from "@/api/httpClient";
import { coverArtCache } from "@/lib/cache/cover-art-cache";
import { metadataCache, type SyncMeta } from "@/lib/cache/metadata-cache";
import { subsonic } from "@/service/subsonic";
import type { Albums } from "@/types/responses/album";
import type { ISimilarArtist } from "@/types/responses/artist";
import type { Genre } from "@/types/responses/genre";
import type { Playlist } from "@/types/responses/playlist";
import type { ISong } from "@/types/responses/song";

// ─── Types ─────────────────────────────────────────────

export type SyncPhase =
  | "idle"
  | "genres"
  | "artists"
  | "playlists"
  | "albums"
  | "songs"
  | "coverArt"
  | "done"
  | "error"
  | "cancelled";

export interface SyncProgress {
  phase: SyncPhase;
  current: number;
  total: number;
  phaseIndex: number;
  totalPhases: number;
}

export interface SyncOptions {
  includeCoverArt: boolean;
  onProgress: (progress: SyncProgress) => void;
  signal: AbortSignal;
}

// ─── Constants ─────────────────────────────────────────

const PAGE_SIZE = 500;
const COVER_ART_CONCURRENCY = 5;
const COVER_ART_SIZE = "300";

// ─── Helpers ───────────────────────────────────────────

function checkCancelled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("Sync cancelled", "AbortError");
  }
}

// ─── Generic Paginated Fetcher ─────────────────────────

async function fetchAllPaginated<T>(
  signal: AbortSignal,
  fetchPage: (offset: number) => Promise<T[]>,
  onPage: (fetched: number) => void,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;

  while (true) {
    checkCancelled(signal);
    const page = await fetchPage(offset);
    all.push(...page);
    onPage(all.length);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

// ─── Cover Art Sync ────────────────────────────────────

async function syncCoverArt(
  albums: Albums[],
  artists: ISimilarArtist[],
  signal: AbortSignal,
  onProgress: (current: number, total: number) => void,
): Promise<void> {
  const items: { id: string; type: "album" | "artist" }[] = [];

  for (const album of albums) {
    if (album.coverArt) {
      items.push({ id: album.coverArt, type: "album" });
    }
  }
  for (const artist of artists) {
    if (artist.coverArt) {
      items.push({ id: artist.coverArt, type: "artist" });
    }
  }

  const total = items.length;
  let completed = 0;

  for (let i = 0; i < items.length; i += COVER_ART_CONCURRENCY) {
    checkCancelled(signal);

    const batch = items.slice(i, i + COVER_ART_CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (item) => {
        const cached = await coverArtCache.getBlob(
          item.id,
          item.type,
          COVER_ART_SIZE,
        );
        if (cached) return;
        const url = getCoverArtUrl(item.id, item.type, COVER_ART_SIZE);
        await coverArtCache.putBlob(item.id, item.type, COVER_ART_SIZE, url);
      }),
    );

    completed += batch.length;
    onProgress(completed, total);
  }
}

// ─── Main Entry Point ──────────────────────────────────

export async function runFullSync(options: SyncOptions): Promise<void> {
  const { includeCoverArt, onProgress, signal } = options;
  const totalPhases = includeCoverArt ? 4 : 3;

  let phaseIndex = 0;

  function reportPhase(phase: SyncPhase, current = 0, total = 0) {
    onProgress({ phase, current, total, phaseIndex, totalPhases });
  }

  try {
    // ── Phase 1: Genres + Artists + Playlists (parallel) ──
    phaseIndex = 1;
    reportPhase("genres");
    checkCancelled(signal);

    const [genres, artists, playlists] = await Promise.all([
      subsonic.genres.get().then((g) => g ?? []) as Promise<Genre[]>,
      subsonic.artists.getAll() as Promise<ISimilarArtist[]>,
      subsonic.playlists.getAll() as Promise<Playlist[]>,
    ]);

    await Promise.all([
      metadataCache.putGenres(genres),
      metadataCache.putArtists(artists),
      metadataCache.putPlaylists(playlists),
    ]);

    reportPhase(
      "genres",
      genres.length + artists.length + playlists.length,
      genres.length + artists.length + playlists.length,
    );

    // ── Phase 2: Albums (paginated) ──
    phaseIndex = 2;
    reportPhase("albums");

    const albums = await fetchAllPaginated<Albums>(
      signal,
      async (offset) => {
        const response = await subsonic.albums.getAlbumList({
          type: "alphabeticalByName",
          size: PAGE_SIZE,
          offset,
        });
        return response?.list ?? [];
      },
      (fetched) => reportPhase("albums", fetched, 0),
    );
    await metadataCache.putAlbums(albums);
    reportPhase("albums", albums.length, albums.length);

    // ── Phase 3: Songs (paginated) ──
    phaseIndex = 3;
    reportPhase("songs");

    const songs = await fetchAllPaginated<ISong>(
      signal,
      async (offset) => {
        const result = await subsonic.search.get({
          query: "",
          songCount: PAGE_SIZE,
          songOffset: offset,
          albumCount: 0,
          artistCount: 0,
        });
        return result?.song ?? [];
      },
      (fetched) => reportPhase("songs", fetched, 0),
    );
    await metadataCache.putSongs(songs);
    reportPhase("songs", songs.length, songs.length);

    // ── Phase 4: Cover Art (optional) ──
    if (includeCoverArt) {
      phaseIndex = 4;
      const coverArtTotal = albums.length + artists.length;
      reportPhase("coverArt", 0, coverArtTotal);
      await syncCoverArt(albums, artists, signal, (current, total) => {
        reportPhase("coverArt", current, total);
      });
    }

    // ── Write final metadata ──
    const meta: SyncMeta = {
      lastSyncedAt: Date.now(),
      songCount: songs.length,
      albumCount: albums.length,
      artistCount: artists.length,
      playlistCount: playlists.length,
      genreCount: genres.length,
    };
    await metadataCache.putMeta(meta);

    phaseIndex = totalPhases;
    reportPhase("done");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      reportPhase("cancelled");
    } else {
      reportPhase("error");
      throw error;
    }
  }
}
