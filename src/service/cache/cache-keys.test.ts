import { describe, expect, it } from "vitest";
import {
  albumKey,
  audioKey,
  coverKey,
  isOldCoverKey,
  playlistKey,
  songIdFromKey,
} from "./cache-keys";

describe("audioKey", () => {
  it("prefixes song id with audio:", () => {
    expect(audioKey("song-1")).toBe("audio:song-1");
  });
});

describe("coverKey", () => {
  it("prefixes cover art id with cover:", () => {
    expect(coverKey("art-1")).toBe("cover:art-1");
  });
});

describe("albumKey", () => {
  it("prefixes album id with album:", () => {
    expect(albumKey("album-1")).toBe("album:album-1");
  });
});

describe("playlistKey", () => {
  it("prefixes playlist id with playlist:", () => {
    expect(playlistKey("pl-1")).toBe("playlist:pl-1");
  });
});

describe("songIdFromKey", () => {
  it("extracts song id from audio key", () => {
    expect(songIdFromKey("audio:song-42")).toBe("song-42");
  });

  it("returns null for non-audio key", () => {
    expect(songIdFromKey("cover:art-1")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(songIdFromKey("")).toBeNull();
  });

  it("returns empty string for bare audio: prefix", () => {
    expect(songIdFromKey("audio:")).toBe("");
  });
});

describe("isOldCoverKey", () => {
  it("returns true for cover keys ending with :digits", () => {
    expect(isOldCoverKey("cover:abc:300")).toBe(true);
    expect(isOldCoverKey("cover:art:1")).toBe(true);
  });

  it("returns false for cover keys without size suffix", () => {
    expect(isOldCoverKey("cover:abc")).toBe(false);
  });

  it("returns false for non-cover keys", () => {
    expect(isOldCoverKey("audio:abc:300")).toBe(false);
  });

  it("returns false when suffix is not numeric", () => {
    expect(isOldCoverKey("cover:abc:xyz")).toBe(false);
  });

  it("returns false for bare cover: prefix", () => {
    expect(isOldCoverKey("cover:")).toBe(false);
  });

  it("returns true for cover key with numeric after last colon", () => {
    expect(isOldCoverKey("cover:some:id:42")).toBe(true);
  });
});
