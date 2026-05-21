import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  NativeAudioEvents,
  NativeAudioPlugin,
} from "@/native/audio/types";
import { LoopState } from "@/types/playerContext";
import { NativeQueueController } from "./native-controller";

type ListenerMap = {
  [TEvent in keyof NativeAudioEvents]?: Array<
    (event: NativeAudioEvents[TEvent]) => void
  >;
};

const mocks = vi.hoisted(() => {
  const listeners: ListenerMap = {};
  const plugin: NativeAudioPlugin = {
    load: vi.fn(async () => {}),
    play: vi.fn(async () => {}),
    pause: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    seek: vi.fn(async () => {}),
    setRepeatMode: vi.fn(async () => {}),
    setShuffle: vi.fn(async () => {}),
    setQueue: vi.fn(async () => {}),
    skipToNext: vi.fn(async () => {}),
    skipToPrevious: vi.fn(async () => {}),
    updateMetadata: vi.fn(async () => {}),
    preload: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    storeAudioFile: vi.fn(async () => ({
      songId: "song-1",
      uri: "file:///native/song-1.mp3",
    })),
    resolveAudioFile: vi.fn(async () => ({ file: null })),
    getAudioFileSize: vi.fn(async () => ({ sizeBytes: null })),
    deleteAudioFile: vi.fn(async () => ({ deleted: false })),
    clearAudioFiles: vi.fn(async () => ({ deletedCount: 0 })),
    setContextQueue: vi.fn(async () => {}),
    addToUserQueue: vi.fn(async () => {}),
    removeFromUserQueue: vi.fn(async () => {}),
    clearUserQueue: vi.fn(async () => {}),
    playAtIndex: vi.fn(async () => {}),
    getFullState: vi.fn(async () => ({
      contextQueue: {
        songs: [],
        currentIndex: 0,
        sourceId: null,
        sourceName: null,
      },
      userQueue: [],
      isInUserQueue: false,
      isShuffleActive: false,
      loopState: "off" as const,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      currentSongId: null,
    })),
    getScrobbleBuffer: vi.fn(async () => ({ entries: [] })),
    clearScrobbleBuffer: vi.fn(async () => {}),
    downloadAudioFile: vi.fn(async () => {}),
    cancelDownload: vi.fn(async () => {}),
    setSystemVolume: vi.fn(async () => {
      throw new Error("not supported");
    }),
    getSystemVolume: vi.fn(async () => {
      throw new Error("not supported");
    }),
    setVolumeHUDEnabled: vi.fn(async () => {}),
    addListener: vi.fn(async (eventName, listener) => {
      listeners[eventName] ??= [];
      listeners[eventName]?.push(listener);
      return {
        remove: vi.fn(async () => {
          listeners[eventName] = listeners[eventName]?.filter(
            (item) => item !== listener,
          );
        }),
      };
    }),
    removeAllListeners: vi.fn(async () => {}),
  };

  const storeState = {
    playerState: {
      loopState: 0,
      isPlaying: true,
      isBuffering: false,
      currentDuration: 123,
      mediaType: "song" as const,
    },
    playerProgress: {
      progress: 123,
      bufferedProgress: 123,
    },
    songlist: {
      contextQueue: {
        songs: [],
        currentIndex: 0,
        sourceId: undefined,
        sourceName: null,
      },
      currentSong: null,
      isInUserQueue: false,
      isShuffleActive: false,
    },
  };

  return {
    plugin,
    listeners,
    storeState,
    getNativeAudioPluginAvailability: vi.fn(() => ({
      available: true as const,
      plugin,
    })),
  };
});

vi.mock("@/native/audio/facade", () => ({
  getNativeAudioPluginAvailability: mocks.getNativeAudioPluginAvailability,
}));

vi.mock("@/store/player.store", () => ({
  usePlayerStore: {
    getState: () => mocks.storeState,
    setState: (
      updater:
        | typeof mocks.storeState
        | ((state: typeof mocks.storeState) => void),
    ) => {
      if (typeof updater === "function") {
        updater(mocks.storeState);
        return;
      }
      Object.assign(mocks.storeState, updater);
    },
  },
}));

vi.mock("@/api/httpClient", () => ({
  getSongStreamUrl: (id: string) => `https://example.test/stream/${id}`,
}));

describe("NativeQueueController terminal playback reset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const value of Object.values(mocks.plugin)) {
      if (typeof value === "function") {
        vi.mocked(value).mockClear();
      }
    }
    for (const key of Object.keys(mocks.listeners) as Array<
      keyof typeof mocks.listeners
    >) {
      delete mocks.listeners[key];
    }
    mocks.storeState.playerState.loopState = LoopState.Off;
    mocks.storeState.playerState.isPlaying = true;
    mocks.storeState.playerState.isBuffering = false;
    mocks.storeState.playerState.currentDuration = 123;
    mocks.storeState.playerProgress.progress = 123;
    mocks.storeState.playerProgress.bufferedProgress = 123;
    mocks.storeState.songlist.contextQueue.songs = [];
    mocks.storeState.songlist.contextQueue.currentIndex = 0;
    mocks.storeState.songlist.currentSong = null;
  });

  it("seeks native playback back to zero after the last track ends", async () => {
    const controller = new NativeQueueController();
    await vi.runAllTimersAsync();

    emit("playbackStateChanged", { state: "ended" });
    await vi.advanceTimersByTimeAsync(150);

    expect(mocks.plugin.seek).toHaveBeenCalledWith({ position: 0 });
    expect(mocks.storeState.playerProgress.progress).toBe(0);
    expect(mocks.storeState.playerProgress.bufferedProgress).toBe(0);
    expect(mocks.storeState.playerState.isPlaying).toBe(false);

    controller.dispose();
  });

  it("does not rewind to zero when native playback advances to the next track", async () => {
    mocks.storeState.songlist.contextQueue.songs = [
      { id: "song-1", duration: 123 } as never,
      { id: "song-2", duration: 234 } as never,
    ];

    const controller = new NativeQueueController();
    await vi.runAllTimersAsync();

    emit("playbackStateChanged", { state: "ended" });
    emit("queueStateChanged", {
      currentIndex: 1,
      songId: "song-2",
      reason: "ended",
    });
    await vi.advanceTimersByTimeAsync(150);

    expect(mocks.plugin.seek).not.toHaveBeenCalledWith({ position: 0 });
    expect(mocks.storeState.playerProgress.progress).toBe(0);
    expect(mocks.storeState.playerState.isPlaying).toBe(true);

    controller.dispose();
  });
});

function emit<TEvent extends keyof NativeAudioEvents>(
  eventName: TEvent,
  event: NativeAudioEvents[TEvent],
) {
  for (const listener of mocks.listeners[eventName] ?? []) {
    listener(event);
  }
}
