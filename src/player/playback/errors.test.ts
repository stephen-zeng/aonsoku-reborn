import { describe, expect, it } from "vitest";
import {
  getPlaybackErrorKind,
  nativePlaybackErrorKind,
  playbackErrorCodeFromKind,
  PLAYBACK_MEDIA_ERROR_CODES,
  shouldRetryPlaybackError,
} from "./errors";
import type { PlaybackErrorEvent } from "./types";

describe("playback error mapping", () => {
  it("maps native iOS error codes to shared playback error kinds", () => {
    expect(nativePlaybackErrorKind("not_connected_to_internet")).toBe(
      "network",
    );
    expect(nativePlaybackErrorKind("timed_out")).toBe("network");
    expect(nativePlaybackErrorKind("decode_failed")).toBe("decode");
    expect(nativePlaybackErrorKind("unsupported_source")).toBe(
      "source-not-supported",
    );
    expect(nativePlaybackErrorKind("seek_cancelled")).toBe("aborted");
    expect(nativePlaybackErrorKind("audio_session_failed")).toBe("unknown");
  });

  it("normalizes DOM and native errors to the same media error codes", () => {
    expect(playbackErrorCodeFromKind("network")).toBe(
      PLAYBACK_MEDIA_ERROR_CODES.network,
    );
    expect(
      getPlaybackErrorKind({
        error: null,
        code: PLAYBACK_MEDIA_ERROR_CODES.sourceNotSupported,
      }),
    ).toBe("source-not-supported");
    expect(
      getPlaybackErrorKind({
        error: null,
        code: "playback_failed",
      }),
    ).toBe("network");
  });

  it("retries network and unknown failures while preserving non-retryable errors", () => {
    const networkError: PlaybackErrorEvent = {
      error: null,
      kind: "network",
    };
    const unknownError: PlaybackErrorEvent = {
      error: null,
      kind: "unknown",
    };
    const decodeError: PlaybackErrorEvent = {
      error: null,
      kind: "decode",
    };
    const unsupportedError: PlaybackErrorEvent = {
      error: null,
      kind: "source-not-supported",
    };

    expect(shouldRetryPlaybackError(networkError)).toBe(true);
    expect(shouldRetryPlaybackError(unknownError)).toBe(true);
    expect(shouldRetryPlaybackError(decodeError)).toBe(false);
    expect(shouldRetryPlaybackError(decodeError, { isRadio: true })).toBe(true);
    expect(shouldRetryPlaybackError(unsupportedError)).toBe(false);
  });
});
