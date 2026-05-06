function fisherYatesInPlace<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function shuffleSongList<T>(list: T[], index: number, isRandom = false) {
  const array = [...list];
  const firstPositionItem = array[index];

  if (!isRandom) {
    array.splice(index, 1);
  }

  fisherYatesInPlace(array);

  if (!isRandom) {
    array.unshift(firstPositionItem);
  }

  return array;
}

const MAX_SHUFFLE_HISTORY = 50;
const MAX_SHUFFLE_START_HISTORY = 20;

export { MAX_SHUFFLE_HISTORY, MAX_SHUFFLE_START_HISTORY };

export function pushToHistory(
  history: string[],
  id: string,
  maxLen: number,
): string[] {
  const result = history.filter((h) => h !== id);
  result.push(id);
  if (result.length > maxLen) {
    return result.slice(result.length - maxLen);
  }
  return result;
}

export function pickRandomStartIndex(
  songlistLength: number,
  startIndexHistory: string[],
  getId: (index: number) => string,
): number {
  if (songlistLength === 0) return 0;

  const historySet = new Set(startIndexHistory);
  const maxAttempts = Math.min(songlistLength, startIndexHistory.length + 10);

  for (let i = 0; i < maxAttempts; i++) {
    const idx = Math.floor(Math.random() * songlistLength);
    if (!historySet.has(getId(idx))) return idx;
  }

  for (let i = 0; i < songlistLength; i++) {
    if (!historySet.has(getId(i))) return i;
  }

  return Math.floor(Math.random() * songlistLength);
}

export function shuffleWithGapAvoidance<T extends { id: string }>(
  songs: T[],
  history: string[],
): T[] {
  if (history.length === 0) {
    const result = [...songs];
    fisherYatesInPlace(result);
    return result;
  }

  const historyIndex = new Map(history.map((id, i) => [id, i]));

  const fresh: T[] = [];
  const recent: T[] = [];

  for (const song of songs) {
    if (historyIndex.has(song.id)) {
      recent.push(song);
    } else {
      fresh.push(song);
    }
  }

  fisherYatesInPlace(fresh);

  recent.sort((a, b) => {
    return (historyIndex.get(a.id) ?? 0) - (historyIndex.get(b.id) ?? 0);
  });

  return [...fresh, ...recent];
}

export function addNextSongList<T>(
  index: number,
  currentList: T[],
  newList: T[],
) {
  const firstPart = currentList.slice(0, index + 1);
  const secondPart = currentList.slice(index + 1);

  const updated = [...firstPart, ...newList, ...secondPart];

  return updated;
}
