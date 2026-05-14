import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CacheTask } from "@/types/cache";
import { AudioCacheQueue } from "./audio-cache-queue";

function makeTask(
  songId: string,
  priority = 1,
  source: CacheTask["source"] = "explicit",
): CacheTask {
  return { songId, priority, source };
}

describe("AudioCacheQueue", () => {
  let queue: AudioCacheQueue;
  let executed: CacheTask[];

  beforeEach(() => {
    executed = [];
  });

  function createQueue(concurrency = 4) {
    const executor = vi.fn(async (task: CacheTask) => {
      executed.push(task);
    });
    queue = new AudioCacheQueue(executor, concurrency);
    return queue;
  }

  it("enqueues and executes a task", async () => {
    const q = createQueue(1);
    await q.enqueue(makeTask("song-1"));
    expect(executed).toHaveLength(1);
    expect(executed[0].songId).toBe("song-1");
  });

  it("deduplicates by songId", async () => {
    const q = createQueue(1);
    const p1 = q.enqueue(makeTask("song-1"));
    const p2 = q.enqueue(makeTask("song-1"));
    await Promise.all([p1, p2]);
    expect(executed).toHaveLength(1);
  });

  it("orders tasks by priority (highest first) when tasks queue while a slot is busy", async () => {
    const results: string[] = [];
    let resolveBlocking: () => void = () => {};
    const blockingPromise = new Promise<void>((r) => {
      resolveBlocking = r;
    });
    const executor = vi.fn(async (task: CacheTask) => {
      if (task.songId === "blocking") {
        await blockingPromise;
      }
      results.push(task.songId);
    });
    queue = new AudioCacheQueue(executor, 1);

    const blocking = queue.enqueue(makeTask("blocking", 0));
    const low = queue.enqueue(makeTask("low", 0));
    const high = queue.enqueue(makeTask("high", 2));
    const mid = queue.enqueue(makeTask("mid", 1));

    resolveBlocking();
    await Promise.all([blocking, low, high, mid]);

    expect(results).toEqual(["blocking", "high", "mid", "low"]);
  });

  it("enqueues multiple different songs concurrently", async () => {
    const q = createQueue(2);
    await Promise.all([
      q.enqueue(makeTask("song-1")),
      q.enqueue(makeTask("song-2")),
    ]);
    expect(executed).toHaveLength(2);
    expect(executed.map((t) => t.songId).sort()).toEqual(["song-1", "song-2"]);
  });

  it("respects concurrency limit", async () => {
    let running = 0;
    let maxRunning = 0;
    const executor = vi.fn(async (task: CacheTask) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      executed.push(task);
    });
    queue = new AudioCacheQueue(executor, 2);

    const tasks = [
      makeTask("s1"),
      makeTask("s2"),
      makeTask("s3"),
      makeTask("s4"),
    ];
    await Promise.all(tasks.map((t) => queue.enqueue(t)));
    expect(executed).toHaveLength(4);
    expect(maxRunning).toBeLessThanOrEqual(2);
  });

  it("isQueued returns true for waiting tasks", async () => {
    let resolveFirst: () => void = () => {};
    const executor = vi.fn(async (task: CacheTask) => {
      if (task.songId === "blocking") {
        await new Promise<void>((r) => {
          resolveFirst = r;
        });
      }
      executed.push(task);
    });
    queue = new AudioCacheQueue(executor, 1);

    const blocking = queue.enqueue(makeTask("blocking"));
    const waiting = queue.enqueue(makeTask("waiting"));

    expect(queue.isQueued("waiting")).toBe(true);

    resolveFirst();
    await Promise.all([blocking, waiting]);
  });

  it("isInFlight returns true for currently executing task", async () => {
    let resolveFirst: () => void = () => {};
    const executor = vi.fn(async (task: CacheTask) => {
      await new Promise<void>((r) => {
        resolveFirst = r;
      });
      executed.push(task);
    });
    queue = new AudioCacheQueue(executor, 1);

    const p = queue.enqueue(makeTask("inflight"));
    expect(queue.isInFlight("inflight")).toBe(true);

    resolveFirst();
    await p;
  });

  it("clear rejects all pending tasks and resets queue state", async () => {
    let resolveTask: () => void = () => {};
    const executor = vi.fn(async () => {
      await new Promise<void>((r) => {
        resolveTask = r;
      });
    });
    queue = new AudioCacheQueue(executor, 1);

    const p1 = queue.enqueue(makeTask("s1"));
    const p2 = queue.enqueue(makeTask("s2"));

    expect(queue.isQueued("s2")).toBe(true);

    queue.clear();

    await expect(p2).rejects.toThrow("Aborted");
    resolveTask();
    await p1;

    expect(queue.isQueued("s2")).toBe(false);
    expect(queue.isInFlight("s2")).toBe(false);
  });

  it("resolves the promise when task completes successfully", async () => {
    const q = createQueue(1);
    let resolved = false;
    const p = q.enqueue(makeTask("song-1"));
    p.then(() => {
      resolved = true;
    });
    await p;
    expect(resolved).toBe(true);
  });

  it("rejects the promise when task executor throws", async () => {
    const errExecutor = vi.fn(async () => {
      throw new Error("download failed");
    });
    queue = new AudioCacheQueue(errExecutor, 1);
    await expect(queue.enqueue(makeTask("bad-song"))).rejects.toThrow(
      "download failed",
    );
  });

  it("FIFO order within same priority", async () => {
    const q = createQueue(1);
    await q.enqueue(makeTask("first", 1));
    await q.enqueue(makeTask("second", 1));
    await q.enqueue(makeTask("third", 1));
    expect(executed.map((t) => t.songId)).toEqual(["first", "second", "third"]);
  });

  it("carries source and triggers in task", async () => {
    const q = createQueue(1);
    const task: CacheTask = {
      songId: "s1",
      priority: 0,
      source: "smart",
      triggers: ["favorite"],
    };
    await q.enqueue(task);
    expect(executed[0]).toEqual(task);
  });

  it("isQueued and isInFlight return false for unknown song", () => {
    const q = createQueue(1);
    expect(q.isQueued("unknown")).toBe(false);
    expect(q.isInFlight("unknown")).toBe(false);
  });

  it("isQueued and isInFlight return false after task completes", async () => {
    const q = createQueue(1);
    await q.enqueue(makeTask("done-song"));
    await new Promise((r) => setTimeout(r, 0));
    expect(q.isQueued("done-song")).toBe(false);
    expect(q.isInFlight("done-song")).toBe(false);
  });

  it("dedup returns same promise even with different priority", async () => {
    const q = createQueue(1);
    const p1 = q.enqueue(makeTask("dup-song", 0));
    const p2 = q.enqueue(makeTask("dup-song", 2));
    expect(p1).toBe(p2);
    await p1;
  });
});
