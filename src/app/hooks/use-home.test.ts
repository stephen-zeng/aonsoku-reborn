import { describe, expect, it } from "vitest";
import {
  getPlaylistPlayedAt,
  sortPinnedHomeItemsByPlayedAt,
  type HomePinnedItemData,
} from "@/app/hooks/use-home";

describe("use-home pinned helpers", () => {
  it("uses the newest played song timestamp for playlists", () => {
    const playedAt = getPlaylistPlayedAt(
      {
        created: "2024-01-01T00:00:00.000Z",
        changed: "2024-01-02T00:00:00.000Z",
      },
      {
        entry: [
          { played: "2024-01-03T00:00:00.000Z" },
          { played: "2024-02-01T00:00:00.000Z" },
        ],
      },
    );

    expect(playedAt).toBe(Date.parse("2024-02-01T00:00:00.000Z"));
  });

  it("falls back to playlist changed date when tracks were never played", () => {
    const playedAt = getPlaylistPlayedAt({
      created: "2024-01-01T00:00:00.000Z",
      changed: "2024-01-02T00:00:00.000Z",
    });

    expect(playedAt).toBe(Date.parse("2024-01-02T00:00:00.000Z"));
  });

  it("sorts mixed pinned items by most recent playback first", () => {
    const items: HomePinnedItemData[] = [
      {
        type: "playlist",
        playedAt: 10,
        playlist: {
          id: "playlist-1",
          name: "Road Trip",
          comment: "",
          songCount: 0,
          duration: 0,
          public: false,
          owner: "",
          created: "",
          changed: "",
          coverArt: "",
        },
      },
      {
        type: "album",
        playedAt: 30,
        album: {
          id: "album-1",
          name: "Alpha",
          artist: "Artist A",
          artistId: "artist-1",
          coverArt: "",
          songCount: 0,
          duration: 0,
          created: "",
          genre: "",
          userRating: 0,
          genres: [],
          musicBrainzId: "",
          isCompilation: false,
          sortName: "Alpha",
          discTitles: [],
        },
      },
      {
        type: "album",
        playedAt: 20,
        album: {
          id: "album-2",
          name: "Beta",
          artist: "Artist B",
          artistId: "artist-2",
          coverArt: "",
          songCount: 0,
          duration: 0,
          created: "",
          genre: "",
          userRating: 0,
          genres: [],
          musicBrainzId: "",
          isCompilation: false,
          sortName: "Beta",
          discTitles: [],
        },
      },
    ];

    expect(sortPinnedHomeItemsByPlayedAt(items)).toMatchObject([
      { type: "album", album: { id: "album-1" } },
      { type: "album", album: { id: "album-2" } },
      { type: "playlist", playlist: { id: "playlist-1" } },
    ]);
  });
});
