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

export { MAX_SHUFFLE_HISTORY };

export function shuffleWithGapAvoidance<T extends { id: string }>(
  songs: T[],
  history: string[],
): T[] {
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
