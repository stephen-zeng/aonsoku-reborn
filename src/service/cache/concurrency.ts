/**
 * Run an async function over items with bounded concurrency.
 * When concurrency is 1, items are processed sequentially.
 */
export async function asyncPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  const total = items.length;
  let completed = 0;

  if (concurrency <= 1) {
    for (const item of items) {
      await fn(item);
      completed += 1;
      onProgress?.(completed, total);
    }
    return;
  }

  let index = 0;

  async function worker(): Promise<void> {
    while (index < total) {
      const currentIndex = index++;
      const item = items[currentIndex];
      await fn(item);
      completed += 1;
      onProgress?.(completed, total);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, total) },
    () => worker(),
  );
  await Promise.all(workers);
}