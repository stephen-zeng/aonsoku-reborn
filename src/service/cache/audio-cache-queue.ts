import type { CacheTask, CacheTaskExecutor } from "@/types/cache";

interface QueuedEntry {
  task: CacheTask;
  resolve: () => void;
  reject: (reason: unknown) => void;
}

/**
 * A global download queue that:
 *  1. Orders tasks by priority (highest first), FIFO within each tier.
 *  2. Deduplicates by songId — repeat enqueues share the same Promise.
 *  3. Limits concurrent downloads to `concurrency` (default 4).
 *
 * Pure scheduler, no DOM / Worker dependencies.  Safe to instantiate
 * in both the main thread and a Web Worker.
 */
export class AudioCacheQueue {
  private readonly concurrency: number;
  private readonly executor: CacheTaskExecutor;
  private running = 0;
  private readonly queue: QueuedEntry[] = [];
  private readonly inflight = new Map<string, Promise<void>>();

  constructor(executor: CacheTaskExecutor, concurrency = 4) {
    this.executor = executor;
    this.concurrency = concurrency;
  }

  /**
   * Add a download task to the queue.
   * Returns a Promise that resolves when the download completes (or
   * rejects on error).  If a task for the same `songId` is already
   * queued or in-flight, returns the existing Promise instead.
   */
  enqueue(task: CacheTask): Promise<void> {
    const existing = this.inflight.get(task.songId);
    if (existing) return existing;

    let resolve!: () => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const entry: QueuedEntry = { task, resolve, reject };

    // Maintain descending priority order; FIFO within equal priority.
    const insertAt = this.queue.findIndex(
      (q) => q.task.priority < task.priority,
    );
    if (insertAt === -1) {
      this.queue.push(entry);
    } else {
      this.queue.splice(insertAt, 0, entry);
    }

    this.inflight.set(task.songId, promise);
    this.schedule();
    return promise;
  }

  private schedule(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const entry = this.queue.shift()!;
      this.running++;
      this.executor(entry.task)
        .then(() => entry.resolve())
        .catch((err) => entry.reject(err))
        .finally(() => {
          this.running--;
          this.inflight.delete(entry.task.songId);
          this.schedule();
        });
    }
  }
}
