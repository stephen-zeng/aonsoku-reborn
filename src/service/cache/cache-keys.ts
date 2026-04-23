export function audioKey(songId: string): string {
  return `audio:${songId}`;
}

export function coverKey(coverArtId: string): string {
  return `cover:${coverArtId}`;
}

export function albumKey(albumId: string): string {
  return `album:${albumId}`;
}

export function playlistKey(playlistId: string): string {
  return `playlist:${playlistId}`;
}

export function songIdFromKey(key: string): string | null {
  if (!key.startsWith("audio:")) return null;
  return key.slice(6);
}

export const COVER_PREFIX = "cover:";

export function isOldCoverKey(key: string): boolean {
  if (!key.startsWith(COVER_PREFIX)) return false;
  const rest = key.slice(COVER_PREFIX.length);
  const lastColon = rest.lastIndexOf(":");
  if (lastColon === -1) return false;
  const afterLastColon = rest.slice(lastColon + 1);
  return /^\d+$/.test(afterLastColon);
}
