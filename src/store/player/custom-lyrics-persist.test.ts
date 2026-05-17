import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SelectedCustomLyrics } from "@/types/playerContext";
import { MAX_SELECTED_CUSTOM_LYRICS } from "@/types/playerContext";

type CustomLyricsEntryWithBody = SelectedCustomLyrics & {
  lyrics?: string;
};

vi.mock("@/service/lyrics", () => ({
  setCustomLyricsBody: vi.fn().mockResolvedValue(undefined),
  getCustomLyricsBody: vi.fn().mockResolvedValue(undefined),
  deleteCustomLyricsBodies: vi.fn().mockResolvedValue([]),
  CUSTOM_LYRICS_IDB_PREFIX: "custom-lyrics:",
}));

import { setCustomLyricsBody } from "@/service/lyrics";
import {
  migrateCustomLyricsBodiesToIdb,
  stripCustomLyricsBodies,
} from "./custom-lyrics-persist";

const mockSetCustomLyricsBody = vi.mocked(setCustomLyricsBody);

describe("stripCustomLyricsBodies", () => {
  it("returns input unchanged when selected is undefined", () => {
    const result = stripCustomLyricsBodies(undefined);
    expect(result.sanitized).toBeUndefined();
    expect(result.evictedKeys).toEqual([]);
  });

  it("returns empty object unchanged", () => {
    const result = stripCustomLyricsBodies({});
    expect(result.sanitized).toEqual({});
    expect(result.evictedKeys).toEqual([]);
  });

  it("strips lyrics property from entries that have it", () => {
    const selected: Record<string, CustomLyricsEntryWithBody> = {
      "song-key-1": { key: "cand-1", title: "T1", lyrics: "la la la" },
      "song-key-2": { key: "cand-2", title: "T2" },
    };
    const result = stripCustomLyricsBodies(selected);
    expect(result.sanitized).toEqual({
      "song-key-1": { key: "cand-1", title: "T1" },
      "song-key-2": { key: "cand-2", title: "T2" },
    });
    expect(result.evictedKeys).toEqual([]);
  });

  it("preserves entries without lyrics property", () => {
    const selected: Record<string, SelectedCustomLyrics> = {
      "song-key-1": { key: "cand-1", title: "T1" },
    };
    const result = stripCustomLyricsBodies(selected);
    expect(result.sanitized).toEqual({
      "song-key-1": { key: "cand-1", title: "T1" },
    });
  });

  it("evicts oldest entries when over MAX_SELECTED_CUSTOM_LYRICS", () => {
    const selected: Record<string, SelectedCustomLyrics> = {};
    const total = MAX_SELECTED_CUSTOM_LYRICS + 5;
    for (let i = 0; i < total; i++) {
      selected[`key-${i}`] = { key: `cand-${i}` };
    }
    const result = stripCustomLyricsBodies(selected);

    expect(Object.keys(result.sanitized!)).toHaveLength(
      MAX_SELECTED_CUSTOM_LYRICS,
    );
    expect(result.evictedKeys).toHaveLength(5);
    expect(result.evictedKeys).toEqual(
      Array.from({ length: 5 }, (_, i) => `key-${i}`),
    );

    for (let i = 5; i < total; i++) {
      expect(result.sanitized![`key-${i}`]).toBeDefined();
    }
  });

  it("does not evict when at exactly MAX_SELECTED_CUSTOM_LYRICS", () => {
    const selected: Record<string, SelectedCustomLyrics> = {};
    for (let i = 0; i < MAX_SELECTED_CUSTOM_LYRICS; i++) {
      selected[`key-${i}`] = { key: `cand-${i}` };
    }
    const result = stripCustomLyricsBodies(selected);
    expect(Object.keys(result.sanitized!)).toHaveLength(
      MAX_SELECTED_CUSTOM_LYRICS,
    );
    expect(result.evictedKeys).toEqual([]);
  });

  it("does not evict when under MAX_SELECTED_CUSTOM_LYRICS", () => {
    const selected: Record<string, SelectedCustomLyrics> = {
      "key-1": { key: "cand-1" },
      "key-2": { key: "cand-2" },
    };
    const result = stripCustomLyricsBodies(selected);
    expect(result.evictedKeys).toEqual([]);
    expect(Object.keys(result.sanitized!)).toHaveLength(2);
  });

  it("filters out null entries", () => {
    const selected: Record<string, CustomLyricsEntryWithBody | null> = {
      "key-1": { key: "cand-1" },
      "key-2": null,
    };
    const result = stripCustomLyricsBodies(selected);
    expect(result.sanitized!["key-1"]).toBeDefined();
    expect(result.sanitized!["key-2"]).toBeUndefined();
  });

  it("both strips lyrics and evicts in the same call", () => {
    const selected: Record<string, CustomLyricsEntryWithBody> = {};
    const total = MAX_SELECTED_CUSTOM_LYRICS + 2;
    for (let i = 0; i < total; i++) {
      selected[`key-${i}`] = {
        key: `cand-${i}`,
        ...(i < 3 ? { lyrics: `lyrics for ${i}` } : {}),
      };
    }
    const result = stripCustomLyricsBodies(selected);

    expect(result.evictedKeys).toHaveLength(2);
    expect(Object.keys(result.sanitized!)).toHaveLength(
      MAX_SELECTED_CUSTOM_LYRICS,
    );

    for (const value of Object.values(result.sanitized!)) {
      expect("lyrics" in value).toBe(false);
    }
  });
});

describe("migrateCustomLyricsBodiesToIdb", () => {
  beforeEach(() => {
    mockSetCustomLyricsBody.mockReset().mockResolvedValue(undefined);
  });

  it("migrates inline lyrics to IDB and deletes from entry", async () => {
    const state = {
      settings: {
        lyrics: {
          selectedCustomLyrics: {
            "song-key-1": { key: "cand-1", lyrics: "la la la" },
            "song-key-2": { key: "cand-2" },
          },
        },
      },
    };

    await migrateCustomLyricsBodiesToIdb(state);

    expect(state.settings.lyrics.selectedCustomLyrics["song-key-1"]).toEqual({
      key: "cand-1",
    });
    expect(state.settings.lyrics.selectedCustomLyrics["song-key-2"]).toEqual({
      key: "cand-2",
    });

    expect(mockSetCustomLyricsBody).toHaveBeenCalledWith(
      "song-key-1",
      "la la la",
    );
    expect(mockSetCustomLyricsBody).not.toHaveBeenCalledWith(
      "song-key-2",
      expect.anything(),
    );
  });

  it("skips entries without lyrics property", async () => {
    const state = {
      settings: {
        lyrics: {
          selectedCustomLyrics: {
            "song-key-1": { key: "cand-1" },
          },
        },
      },
    };

    await migrateCustomLyricsBodiesToIdb(state);

    expect(state.settings.lyrics.selectedCustomLyrics["song-key-1"]).toEqual({
      key: "cand-1",
    });
    expect(mockSetCustomLyricsBody).not.toHaveBeenCalled();
  });

  it("skips entries with empty lyrics string", async () => {
    const state = {
      settings: {
        lyrics: {
          selectedCustomLyrics: {
            "song-key-1": { key: "cand-1", lyrics: "" },
          },
        },
      },
    };

    await migrateCustomLyricsBodiesToIdb(state);

    expect(state.settings.lyrics.selectedCustomLyrics["song-key-1"]).toEqual({
      key: "cand-1",
    });
    expect(mockSetCustomLyricsBody).not.toHaveBeenCalled();
  });

  it("handles undefined selectedCustomLyrics gracefully", async () => {
    const state = { settings: { lyrics: {} } };
    await expect(
      migrateCustomLyricsBodiesToIdb(state),
    ).resolves.toBeUndefined();
    expect(mockSetCustomLyricsBody).not.toHaveBeenCalled();
  });

  it("handles null state gracefully", async () => {
    await expect(migrateCustomLyricsBodiesToIdb(null)).resolves.toBeUndefined();
    expect(mockSetCustomLyricsBody).not.toHaveBeenCalled();
  });

  it("migrates multiple entries", async () => {
    const state = {
      settings: {
        lyrics: {
          selectedCustomLyrics: {
            "sk-1": { key: "c1", lyrics: "lyrics 1" },
            "sk-2": { key: "c2", lyrics: "lyrics 2" },
            "sk-3": { key: "c3", lyrics: "lyrics 3" },
          },
        },
      },
    };

    await migrateCustomLyricsBodiesToIdb(state);

    expect(mockSetCustomLyricsBody).toHaveBeenCalledTimes(3);
    expect(mockSetCustomLyricsBody).toHaveBeenCalledWith("sk-1", "lyrics 1");
    expect(mockSetCustomLyricsBody).toHaveBeenCalledWith("sk-2", "lyrics 2");
    expect(mockSetCustomLyricsBody).toHaveBeenCalledWith("sk-3", "lyrics 3");

    for (const entry of Object.values(
      state.settings.lyrics.selectedCustomLyrics,
    )) {
      expect("lyrics" in entry).toBe(false);
    }
  });
});
