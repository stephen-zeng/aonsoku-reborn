import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/httpClient", () => ({
  getSongStreamUrl: vi.fn((songId: string) => `/stream?id=${songId}&v=1`),
}));

import { audioUrlResolver, buildAudioUrl } from "./audio-url-resolver";

describe("audioUrlResolver", () => {
  it("builds stream URLs without cache-busting", () => {
    expect(buildAudioUrl("song-1", "stream")).toBe("/stream?id=song-1&v=1");
  });

  it("builds cache URLs with the cache purpose marker", () => {
    expect(audioUrlResolver.buildAudioUrl("song-1", "cache")).toBe(
      "/stream?id=song-1&v=1&_c=1",
    );
  });
});
