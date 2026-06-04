import { beforeEach, describe, expect, it } from "vitest";
import { usePinnedHomeStore } from "@/store/pinned-home.store";

describe("pinned-home.store", () => {
  beforeEach(() => {
    localStorage.clear();
    usePinnedHomeStore.setState({ items: [] });
  });

  it("pins a new item only once", () => {
    const { pin } = usePinnedHomeStore.getState().actions;

    pin({ id: "album-1", type: "album" });
    pin({ id: "album-1", type: "album" });

    expect(usePinnedHomeStore.getState().items).toEqual([
      { id: "album-1", type: "album" },
    ]);
  });

  it("unpins an existing item", () => {
    const { pin, unpin } = usePinnedHomeStore.getState().actions;

    pin({ id: "album-1", type: "album" });
    pin({ id: "playlist-1", type: "playlist" });
    unpin({ id: "album-1", type: "album" });

    expect(usePinnedHomeStore.getState().items).toEqual([
      { id: "playlist-1", type: "playlist" },
    ]);
  });

  it("toggles items for albums and playlists", () => {
    const { toggle, isPinned } = usePinnedHomeStore.getState().actions;

    toggle({ id: "album-1", type: "album" });
    toggle({ id: "playlist-1", type: "playlist" });

    expect(isPinned({ id: "album-1", type: "album" })).toBe(true);
    expect(isPinned({ id: "playlist-1", type: "playlist" })).toBe(true);

    toggle({ id: "album-1", type: "album" });

    expect(isPinned({ id: "album-1", type: "album" })).toBe(false);
    expect(isPinned({ id: "playlist-1", type: "playlist" })).toBe(true);
  });

  it("rehydrates persisted items", async () => {
    usePinnedHomeStore.setState({ items: [] });
    localStorage.setItem(
      "pinned_home_store",
      JSON.stringify({
        state: {
          items: [{ id: "playlist-2", type: "playlist" }],
        },
        version: 1,
      }),
    );

    await usePinnedHomeStore.persist.rehydrate();

    expect(usePinnedHomeStore.getState().items).toEqual([
      { id: "playlist-2", type: "playlist" },
    ]);
  });
});
