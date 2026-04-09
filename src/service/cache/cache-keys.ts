export function audioKey(songId: string): string {
  return `audio:${songId}`;
}

export function coverKey(
  coverArtId: string,
  size = "300",
): string {
  return `cover:${coverArtId}:${size}`;
}

export function songIdFromKey(key: string): string | null {
  if (!key.startsWith("audio:")) return null;
  return key.slice(6);
}
