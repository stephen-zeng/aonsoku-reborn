import { getSongStreamUrl } from "@/api/httpClient";
import type {
  CacheAudioPurpose,
  CacheAudioUrlResolver,
} from "./contracts";

/**
 * Build a URL for fetching audio.
 * Always uses /stream with no maxBitRate, letting the server decide
 * the output quality.
 *
 * `purpose: "cache"` adds a `_c=1` query param so the Service Worker's
 * stale-while-revalidate API cache doesn't collide with a concurrent
 * stream request for the same song.
 */
export function buildAudioUrl(
  songId: string,
  purpose: CacheAudioPurpose,
): string {
  const url = getSongStreamUrl(songId);
  return purpose === "cache" ? `${url}&_c=1` : url;
}

export const audioUrlResolver: CacheAudioUrlResolver = {
  buildAudioUrl,
};
