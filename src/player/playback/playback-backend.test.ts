import { describe, expect, it, vi } from "vitest";
import { LoopState } from "@/types/playerContext";
import {
  createUrlPlaybackSource,
  getRegisteredPlaybackBackend,
  getPlaybackSourceUrl,
  playbackRepeatModeFromLoopState,
  registerPlaybackBackend,
  seekPlaybackTarget,
  type PlaybackBackend,
  type PlaybackBackendEvent,
  type PlaybackBackendEvents,
  type PlaybackBackendListener,
  type PlaybackMetadata,
  type PlaybackRepeatMode,
  type PlaybackSource,
  WebAudioPlaybackBackend,
} from ".";

class MemoryPlaybackBackend implements PlaybackBackend {
  source: PlaybackSource | null = null;
  metadata: PlaybackMetadata | null = null;
  preloadedSource: PlaybackSource | null = null;
  isPlaying = false;
  currentTime = 0;
  loop = false;
  repeatMode: PlaybackRepeatMode = "off";
  shuffle = false;
  skipNextCount = 0;
  skipPreviousCount = 0;
  volume = 1;
  disposed = false;
  readonly listeners = new Map<
    PlaybackBackendEvent,
    Set<PlaybackBackendListener<PlaybackBackendEvent>>
  >();

  load(source: PlaybackSource, metadata?: PlaybackMetadata) {
    this.source = source;
    this.metadata = metadata ?? null;
  }

  async play() {
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  stop() {
    this.isPlaying = false;
    this.currentTime = 0;
  }

  seek(seconds: number) {
    this.currentTime = seconds;
  }

  setLoop(enabled: boolean) {
    this.loop = enabled;
  }

  setRepeatMode(mode: PlaybackRepeatMode) {
    this.repeatMode = mode;
  }

  setShuffle(enabled: boolean) {
    this.shuffle = enabled;
  }

  skipToNext() {
    this.skipNextCount += 1;
  }

  skipToPrevious() {
    this.skipPreviousCount += 1;
  }

  setVolume(value: number) {
    this.volume = value;
  }

  updateMetadata(metadata: PlaybackMetadata) {
    this.metadata = metadata;
  }

  preload(source: PlaybackSource) {
    this.preloadedSource = source;
  }

  dispose() {
    this.disposed = true;
    this.listeners.clear();
  }

  subscribe<TEvent extends PlaybackBackendEvent>(
    event: TEvent,
    listener: PlaybackBackendListener<TEvent>,
  ) {
    const listeners =
      this.listeners.get(event) ??
      new Set<PlaybackBackendListener<PlaybackBackendEvent>>();
    listeners.add(listener as PlaybackBackendListener<PlaybackBackendEvent>);
    this.listeners.set(event, listeners);

    return () => {
      listeners.delete(
        listener as PlaybackBackendListener<PlaybackBackendEvent>,
      );
    };
  }

  emit<TEvent extends PlaybackBackendEvent>(
    event: TEvent,
    payload: PlaybackBackendEvents[TEvent],
  ) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(payload as PlaybackBackendEvents[PlaybackBackendEvent]);
    }
  }
}

class FakeAudioElement extends EventTarget {
  src = "";
  currentSrc = "";
  currentTime = 0;
  duration = 0;
  volume = 1;
  loop = false;
  preload = "";
  paused = true;
  ended = false;
  error: MediaError | null = null;
  buffered: TimeRanges = {
    length: 0,
    start: vi.fn(),
    end: vi.fn(),
  };
  load = vi.fn();
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  removeAttribute = vi.fn((name: string) => {
    if (name === "src") {
      this.src = "";
      this.currentSrc = "";
    }
  });
}

function makeAudio() {
  return new FakeAudioElement() as unknown as HTMLAudioElement;
}

describe("playback source descriptors", () => {
  it("normalizes stream, blob, radio, and native file URLs", () => {
    const stream = createUrlPlaybackSource("https://server/stream", {
      songId: "song-1",
    });
    const blob = createUrlPlaybackSource("blob:https://server/blob", {
      songId: "song-2",
    });
    const radio = createUrlPlaybackSource("https://radio/stream", {
      kind: "radio",
      radioId: "radio-1",
    });
    const nativeFile: PlaybackSource = {
      kind: "native-file",
      uri: "file:///audio/song.flac",
      songId: "song-3",
    };

    expect(stream).toEqual({
      kind: "stream",
      url: "https://server/stream",
      songId: "song-1",
    });
    expect(blob.kind).toBe("blob");
    expect(radio).toEqual({
      kind: "radio",
      url: "https://radio/stream",
      radioId: "radio-1",
    });
    expect(getPlaybackSourceUrl(nativeFile)).toBe("file:///audio/song.flac");
  });
});

describe("PlaybackBackend contract", () => {
  it("supports loading, transport controls, queue controls, seeking, volume, and preload", async () => {
    const backend = new MemoryPlaybackBackend();
    const source = createUrlPlaybackSource("https://server/song.mp3");
    const preloadSource = createUrlPlaybackSource("https://server/next.mp3");
    const metadata = {
      title: "Song",
      artist: "Artist",
      album: "Album",
      duration: 123,
      artworkUrl: "https://server/art.jpg",
    };

    backend.load(source, metadata);
    await backend.play();
    backend.seek(42);
    backend.setLoop(true);
    backend.setRepeatMode("all");
    backend.setShuffle(true);
    backend.skipToNext();
    backend.skipToPrevious();
    backend.setVolume(0.4);
    backend.updateMetadata({ title: "Updated Song" });
    backend.preload(preloadSource);

    expect(backend.source).toBe(source);
    expect(backend.metadata).toEqual({ title: "Updated Song" });
    expect(backend.isPlaying).toBe(true);
    expect(backend.currentTime).toBe(42);
    expect(backend.loop).toBe(true);
    expect(backend.repeatMode).toBe("all");
    expect(backend.shuffle).toBe(true);
    expect(backend.skipNextCount).toBe(1);
    expect(backend.skipPreviousCount).toBe(1);
    expect(backend.volume).toBe(0.4);
    expect(backend.preloadedSource).toBe(preloadSource);

    backend.stop();
    expect(backend.isPlaying).toBe(false);
    expect(backend.currentTime).toBe(0);
  });

  it("maps player loop state to backend repeat modes", () => {
    expect(playbackRepeatModeFromLoopState(LoopState.Off)).toBe("off");
    expect(playbackRepeatModeFromLoopState(LoopState.All)).toBe("all");
    expect(playbackRepeatModeFromLoopState(LoopState.One)).toBe("one");
  });

  it("subscribes and unsubscribes typed playback events", () => {
    const backend = new MemoryPlaybackBackend();
    const progressListener = vi.fn();
    const bufferingListener = vi.fn();

    const unsubscribeProgress = backend.subscribe("progress", progressListener);
    backend.subscribe("buffering", bufferingListener);

    backend.emit("progress", {
      currentTime: 12,
      duration: 180,
      bufferedTime: 60,
    });
    backend.emit("buffering", { isBuffering: true });
    unsubscribeProgress();
    backend.emit("progress", {
      currentTime: 18,
      duration: 180,
      bufferedTime: 90,
    });

    expect(progressListener).toHaveBeenCalledTimes(1);
    expect(progressListener).toHaveBeenCalledWith({
      currentTime: 12,
      duration: 180,
      bufferedTime: 60,
    });
    expect(bufferingListener).toHaveBeenCalledWith({ isBuffering: true });
  });

  it("registers active backends for non-DOM seek requests", () => {
    const audio = makeAudio();
    const backend = new MemoryPlaybackBackend();
    const unregister = registerPlaybackBackend(audio, backend);

    expect(getRegisteredPlaybackBackend(audio)).toBe(backend);
    seekPlaybackTarget(audio, 36);
    expect(backend.currentTime).toBe(36);
    expect(audio.currentTime).toBe(0);

    unregister();
    expect(getRegisteredPlaybackBackend(audio)).toBeNull();
    seekPlaybackTarget(audio, 12);
    expect(audio.currentTime).toBe(12);
  });
});

describe("WebAudioPlaybackBackend", () => {
  it("wraps an HTML audio element with backend controls", async () => {
    const audio = makeAudio();
    const backend = new WebAudioPlaybackBackend(audio);
    const source = createUrlPlaybackSource("https://server/song.mp3");

    backend.load(source);
    await backend.play();
    backend.pause();
    backend.seek(36);
    backend.setLoop(true);
    backend.setVolume(1.5);

    expect(audio.src).toBe("https://server/song.mp3");
    expect(audio.load).toHaveBeenCalledTimes(1);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(36);
    expect(audio.loop).toBe(true);
    expect(audio.volume).toBe(1);
  });

  it("preloads through a separate audio element", () => {
    const audio = makeAudio();
    const preloadAudio = makeAudio();
    const backend = new WebAudioPlaybackBackend(audio, {
      createPreloadElement: () => preloadAudio,
    });

    backend.preload(createUrlPlaybackSource("https://server/next.mp3"));

    expect(preloadAudio.preload).toBe("auto");
    expect(preloadAudio.src).toBe("https://server/next.mp3");
    expect(preloadAudio.load).toHaveBeenCalledTimes(1);
  });

  it("maps audio element events to backend events", () => {
    const audio = makeAudio();
    const progressListener = vi.fn();
    const durationListener = vi.fn();
    const bufferingListener = vi.fn();
    const errorListener = vi.fn();
    const endedListener = vi.fn();
    const backend = new WebAudioPlaybackBackend(audio);

    audio.currentTime = 21;
    audio.duration = 180;
    audio.buffered = {
      length: 1,
      start: vi.fn(),
      end: vi.fn(() => 75),
    };
    audio.error = { code: 2, message: "network" } as MediaError;

    backend.subscribe("progress", progressListener);
    backend.subscribe("duration", durationListener);
    backend.subscribe("buffering", bufferingListener);
    backend.subscribe("error", errorListener);
    backend.subscribe("ended", endedListener);

    audio.dispatchEvent(new Event("timeupdate"));
    audio.dispatchEvent(new Event("durationchange"));
    audio.dispatchEvent(new Event("waiting"));
    audio.dispatchEvent(new Event("playing"));
    audio.dispatchEvent(new Event("error"));
    audio.dispatchEvent(new Event("ended"));

    expect(progressListener).toHaveBeenCalledWith({
      currentTime: 21,
      duration: 180,
      bufferedTime: 75,
    });
    expect(durationListener).toHaveBeenCalledWith({ duration: 180 });
    expect(bufferingListener).toHaveBeenNthCalledWith(1, {
      isBuffering: true,
    });
    expect(bufferingListener).toHaveBeenNthCalledWith(2, {
      isBuffering: false,
    });
    expect(errorListener).toHaveBeenCalledWith({
      error: audio.error,
      code: 2,
      message: "network",
    });
    expect(endedListener).toHaveBeenCalledTimes(1);
  });

  it("cleans up event and preload resources on dispose", () => {
    const audio = makeAudio();
    const preloadAudio = makeAudio();
    const backend = new WebAudioPlaybackBackend(audio, {
      createPreloadElement: () => preloadAudio,
    });
    const progressListener = vi.fn();

    backend.subscribe("progress", progressListener);
    backend.preload(createUrlPlaybackSource("https://server/next.mp3"));
    backend.dispose();

    audio.dispatchEvent(new Event("timeupdate"));

    expect(progressListener).not.toHaveBeenCalled();
    expect(preloadAudio.removeAttribute).toHaveBeenCalledWith("src");
    expect(preloadAudio.load).toHaveBeenCalledTimes(2);
    expect(() =>
      backend.load(createUrlPlaybackSource("https://server/song.mp3")),
    ).toThrow("Playback backend has been disposed");
  });
});
