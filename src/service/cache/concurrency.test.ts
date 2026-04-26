import { describe, expect, it } from "vitest";
import { asyncPool } from "./concurrency";

describe("asyncPool", () => {
  it("processes items sequentially when concurrency is 1", async () => {
    const order: number[] = [];
    await asyncPool(
      [1, 2, 3],
      1,
      async (item) => {
        order.push(item);
      },
    );
    expect(order).toEqual([1, 2, 3]);
  });

  it("runs up to concurrency items simultaneously", async () => {
    let running = 0;
    let maxRunning = 0;
    await asyncPool(
      [1, 2, 3, 4, 5],
      2,
      async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 10));
        running--;
      },
    );
    expect(maxRunning).toBeGreaterThan(1);
    expect(maxRunning).toBeLessThanOrEqual(2);
  });

  it("calls onProgress after each item completes", async () => {
    const progress: Array<{ completed: number; total: number }> = [];
    await asyncPool(
      ["a", "b", "c"],
      1,
      async () => {},
      (completed, total) => {
        progress.push({ completed, total });
      },
    );
    expect(progress).toEqual([
      { completed: 1, total: 3 },
      { completed: 2, total: 3 },
      { completed: 3, total: 3 },
    ]);
  });

  it("handles an empty items array", async () => {
    const results: string[] = [];
    await asyncPool([], 1, async (item) => {
      results.push(item);
    });
    expect(results).toEqual([]);
  });

  it("handles a single item", async () => {
    let called = false;
    await asyncPool(["only"], 1, async (item) => {
      expect(item).toBe("only");
      called = true;
    });
    expect(called).toBe(true);
  });

  it("processes all items even with concurrency higher than item count", async () => {
    const results: number[] = [];
    await asyncPool([1, 2], 10, async (item) => {
      results.push(item);
    });
    expect(results.sort()).toEqual([1, 2]);
  });

  it("propagates errors from fn with concurrency 1", async () => {
    await expect(
      asyncPool([1], 1, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("propagates errors from fn with concurrency > 1", async () => {
    await expect(
      asyncPool([1, 2, 3], 3, async (item) => {
        if (item === 2) throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("handles concurrency of 0 as sequential", async () => {
    const order: number[] = [];
    await asyncPool(
      [1, 2, 3],
      0,
      async (item) => {
        order.push(item);
      },
    );
    expect(order).toEqual([1, 2, 3]);
  });

  it("calls onProgress with concurrency > 1", async () => {
    const progress: Array<{ completed: number; total: number }> = [];
    await asyncPool(
      [1, 2, 3, 4],
      2,
      async () => {},
      (completed, total) => {
        progress.push({ completed, total });
      },
    );
    expect(progress.length).toBe(4);
    for (const p of progress) {
      expect(p.total).toBe(4);
    }
    const completedValues = progress.map((p) => p.completed);
    expect(completedValues.sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });
});