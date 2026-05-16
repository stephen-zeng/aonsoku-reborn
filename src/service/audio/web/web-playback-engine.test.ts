import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("standardized-audio-context", () => ({
  AudioContext: vi.fn(),
}));

vi.stubGlobal("MediaError", {
  MEDIA_ERR_ABORTED: 1,
  MEDIA_ERR_NETWORK: 2,
  MEDIA_ERR_DECODE: 3,
  MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
});

let mockAudio: Record<string, unknown>;
const eventHandlers = new Map<string, Set<(...args: unknown[]) => void>>();

function createMockAudio() {
  eventHandlers.clear();
  mockAudio = {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    load: vi.fn(),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (!eventHandlers.has(event)) eventHandlers.set(event, new Set());
      eventHandlers.get(event)!.add(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: () => void) => {
      eventHandlers.get(event)?.delete(handler);
    }),
    removeAttribute: vi.fn(),
    src: "",
    currentTime: 0,
    duration: 180,
    paused: true,
    readyState: 0,
    volume: 1,
    preload: "",
    playsInline: false,
    buffered: { length: 0, end: () => 0 },
    error: null,
  };
  return mockAudio;
}

// biome-ignore lint/suspicious/noExplicitAny: mock constructor for Audio
vi.stubGlobal("Audio", function (this: any) {
  Object.assign(this, createMockAudio());
  mockAudio = this;
  return this;
});

import { WebPlaybackEngine } from "./web-playback-engine";

beforeEach(() => {
  eventHandlers.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function fireEvent(name: string) {
  const handlers = eventHandlers.get(name);
  if (handlers) {
    for (const h of handlers) h();
  }
}

describe("WebPlaybackEngine", () => {
  it("creates an audio element on construction", () => {
    const engine = new WebPlaybackEngine();
    expect(engine.getAudioElement()).toBe(mockAudio);
    expect(mockAudio.preload).toBe("auto");
    engine.destroy();
  });

  it("setSrc sets the audio source", () => {
    const engine = new WebPlaybackEngine();
    engine.setSrc("http://example.com/song.mp3", "song-1");
    expect(mockAudio.src).toBe("http://example.com/song.mp3");
    engine.destroy();
  });

  it("play calls audio.play()", async () => {
    const engine = new WebPlaybackEngine();
    await engine.play();
    expect(mockAudio.play).toHaveBeenCalled();
    engine.destroy();
  });

  it("pause calls audio.pause()", () => {
    const engine = new WebPlaybackEngine();
    engine.pause();
    expect(mockAudio.pause).toHaveBeenCalled();
    engine.destroy();
  });

  it("seek sets currentTime", () => {
    const engine = new WebPlaybackEngine();
    engine.seek(42);
    expect(mockAudio.currentTime).toBe(42);
    engine.destroy();
  });

  it("setVolume sets audio volume", () => {
    const engine = new WebPlaybackEngine();
    engine.setVolume(0.5);
    expect(mockAudio.volume).toBe(0.5);
    engine.destroy();
  });

  it("emits timeUpdate events", () => {
    const engine = new WebPlaybackEngine();
    const handler = vi.fn();
    engine.on("timeUpdate", handler);

    mockAudio.currentTime = 10;
    fireEvent("timeupdate");

    expect(handler).toHaveBeenCalledWith(10);
    engine.destroy();
  });

  it("emits play/pause events", () => {
    const engine = new WebPlaybackEngine();
    const playHandler = vi.fn();
    const pauseHandler = vi.fn();
    engine.on("play", playHandler);
    engine.on("pause", pauseHandler);

    fireEvent("play");
    fireEvent("pause");

    expect(playHandler).toHaveBeenCalledTimes(1);
    expect(pauseHandler).toHaveBeenCalledTimes(1);
    engine.destroy();
  });

  it("emits error events with mapped codes", () => {
    const engine = new WebPlaybackEngine();
    const handler = vi.fn();
    engine.on("error", handler);

    mockAudio.error = { code: 2, message: "Network error" } as MediaError;
    fireEvent("error");

    expect(handler).toHaveBeenCalledWith({
      code: "network",
      message: "Network error",
      retriable: true,
    });
    engine.destroy();
  });

  it("off removes event handlers", () => {
    const engine = new WebPlaybackEngine();
    const handler = vi.fn();
    engine.on("play", handler);
    engine.off("play", handler);

    fireEvent("play");
    expect(handler).not.toHaveBeenCalled();
    engine.destroy();
  });

  it("destroy stops emitting events", () => {
    const engine = new WebPlaybackEngine();
    const handler = vi.fn();
    engine.on("play", handler);

    engine.destroy();
    fireEvent("play");

    expect(handler).not.toHaveBeenCalled();
  });

  it("getCurrentTime returns audio currentTime", () => {
    const engine = new WebPlaybackEngine();
    mockAudio.currentTime = 55;
    expect(engine.getCurrentTime()).toBe(55);
    engine.destroy();
  });

  it("getDuration returns audio duration", () => {
    const engine = new WebPlaybackEngine();
    mockAudio.duration = 200;
    expect(engine.getDuration()).toBe(200);
    engine.destroy();
  });

  it("isPaused returns audio paused state", () => {
    const engine = new WebPlaybackEngine();
    mockAudio.paused = false;
    expect(engine.isPaused()).toBe(false);
    engine.destroy();
  });
});
