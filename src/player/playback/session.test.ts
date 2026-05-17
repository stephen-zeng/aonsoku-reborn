import { describe, expect, it, vi } from "vitest";
import type { ISongList } from "@/types/playerContext";
import { LoopState } from "@/types/playerContext";
import type { ISong } from "@/types/responses/song";
import { emptyContextQueue, initSonglistState } from "@/store/player/queue-utils";
import {
  getAudioDurationSeconds,
  getAudioProgressSnapshot,
  getBufferedTime,
  getPlaybackEndedDecision,
  PlaybackSession,
  type PlaybackRetryContext,
  type PlaybackSessionAudio,
} from "./session";

function makeAudio(
  overrides: Partial<PlaybackSessionAudio> = {},
): PlaybackSessionAudio {
  return {
    currentTime: 0,
    duration: 180,
    src: "https://server/song.mp3",
    error: null,
    buffered: {
      length: 0,
      end: vi.fn(),
    },
    ...overrides,
  };
}

function makeSong(id: string): ISong {
  return { id, duration: 180 } as ISong;
}

function makeSonglist(overrides: Partial<ISongList> = {}): ISongList {
  return {
    ...initSonglistState(),
    contextQueue: {
      ...emptyContextQueue(),
      songs: [makeSong("song-1")],
      currentIndex: 0,
    },
    currentSong: makeSong("song-1"),
    ...overrides,
  };
}

function createRetryContext(
  session: PlaybackSession<PlaybackSessionAudio>,
  overrides: Partial<PlaybackRetryContext<PlaybackSessionAudio>> = {},
) {
  const audio = overrides.audio ?? makeAudio({ currentTime: 45 });
  let currentAudio: PlaybackSessionAudio | null = audio;
  let playing = true;
  const context: PlaybackRetryContext<PlaybackSessionAudio> & {
    setCurrentAudio: (audio: PlaybackSessionAudio | null) => void;
    setPlaying: (value: boolean) => void;
  } = {
    audio,
    getCurrentAudio: () => currentAudio,
    getStoreProgress: vi.fn(() => 40),
    setStoreProgress: vi.fn(),
    isOnline: vi.fn(() => true),
    shouldResume: vi.fn(() => playing),
    loadAudio: vi.fn(),
    seekAudio: vi.fn((target, seconds) => {
      target.currentTime = seconds;
    }),
    playAudio: vi.fn(),
    onPlaybackError: vi.fn(),
    setCurrentAudio: (nextAudio) => {
      currentAudio = nextAudio;
    },
    setPlaying: (value) => {
      playing = value;
    },
    ...overrides,
  };

  return { session, context };
}

describe("PlaybackSession source changes", () => {
  it("resets retry state and records the loaded source id", () => {
    const session = new PlaybackSession<PlaybackSessionAudio>();

    session.scheduleRetry(createRetryContext(session).context);
    const result = session.beginSourceChange("song-2");

    expect(result.cancelledRetry).toBe(true);
    expect(result.retryCount).toBe(1);
    expect(session.retryCount).toBe(0);
    expect(session.loadedSourceId).toBe("song-2");
    expect(session.sourceChanging).toBe(true);
  });

  it("handles initial resume position during source change", () => {
    const session = new PlaybackSession<PlaybackSessionAudio>();

    session.beginSourceChange("song-1", { resumePosition: 120 });

    expect(session.pendingResumePosition).toBe(120);
    expect(session.shouldSuppressProgressUpdate()).toBe(true);

    session.finishCanPlay();
    expect(session.pendingResumePosition).toBe(null);
    expect(session.shouldSuppressProgressUpdate()).toBe(false);
  });

  it("tracks whether a playback effect belongs to the loaded source", () => {
    const session = new PlaybackSession<PlaybackSessionAudio>();

    session.beginSourceChange("song-1");

    expect(session.hasLoadedSource("song-1")).toBe(true);
    expect(session.hasLoadedSource("song-2")).toBe(false);
  });
});

describe("PlaybackSession retry orchestration", () => {
  it("schedules exponential retry and resumes the same source", () => {
    const timeout = vi.fn((callback: () => void) => {
      callback();
      return 1 as unknown as ReturnType<typeof setTimeout>;
    });
    const session = new PlaybackSession<PlaybackSessionAudio>({
      setTimeoutFn: timeout as typeof setTimeout,
      clearTimeoutFn: vi.fn() as typeof clearTimeout,
    });
    const { context } = createRetryContext(session);
    const events = vi.fn();

    const result = session.scheduleRetry(context, events);

    expect(result).toEqual({
      type: "scheduled",
      attempt: 1,
      delay: 1000,
      resumePosition: 45,
    });
    expect(timeout).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect(context.loadAudio).toHaveBeenCalledWith(context.audio);
    expect(context.playAudio).toHaveBeenCalledWith(context.audio, "Retry");
    expect(events).toHaveBeenCalledWith({ type: "retry" });
  });

  it("retries native placeholder audio using store progress", () => {
    const timeout = vi.fn((callback: () => void) => {
      callback();
      return 1 as unknown as ReturnType<typeof setTimeout>;
    });
    const session = new PlaybackSession<PlaybackSessionAudio>({
      setTimeoutFn: timeout as typeof setTimeout,
      clearTimeoutFn: vi.fn() as typeof clearTimeout,
    });
    const audio = makeAudio({ currentTime: 0, src: "" });
    const { context } = createRetryContext(session, {
      audio,
      getStoreProgress: vi.fn(() => 73),
    });

    const result = session.scheduleRetry(context);

    expect(result).toEqual({
      type: "scheduled",
      attempt: 1,
      delay: 1000,
      resumePosition: 73,
    });
    expect(context.loadAudio).toHaveBeenCalledWith(audio);
    expect(context.playAudio).toHaveBeenCalledWith(audio, "Retry");
  });

  it("does not retry when playback was paused before the timer fires", () => {
    let retryCallback: (() => void) | null = null;
    const session = new PlaybackSession<PlaybackSessionAudio>({
      setTimeoutFn: ((callback: () => void) => {
        retryCallback = callback;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimeoutFn: vi.fn() as typeof clearTimeout,
    });
    const { context } = createRetryContext(session);
    const events = vi.fn();

    session.scheduleRetry(context, events);
    context.setPlaying(false);
    retryCallback?.();

    expect(context.loadAudio).not.toHaveBeenCalled();
    expect(context.playAudio).not.toHaveBeenCalled();
    expect(events).toHaveBeenCalledWith({
      type: "skipped",
      reason: "playbackStopped",
    });
  });

  it("falls back to the start after max retries while preserving resume position", () => {
    const session = new PlaybackSession<PlaybackSessionAudio>({
      maxRetries: 1,
      setTimeoutFn: vi.fn() as unknown as typeof setTimeout,
      clearTimeoutFn: vi.fn() as typeof clearTimeout,
    });
    const { context } = createRetryContext(session);

    session.scheduleRetry(context);
    const result = session.scheduleRetry(context);

    expect(result).toEqual({
      type: "rangeFallback",
      fallbackPosition: 45,
    });
    expect(context.seekAudio).toHaveBeenCalledWith(context.audio, 0);
    expect(context.setStoreProgress).toHaveBeenCalledWith(0);
    expect(context.loadAudio).toHaveBeenCalledWith(context.audio);
    expect(context.playAudio).toHaveBeenCalledWith(
      context.audio,
      "RangeFallback",
    );
    expect(session.pendingResumePosition).toBe(45);
  });

  it("reports playback error when fallback retry also fails", () => {
    const session = new PlaybackSession<PlaybackSessionAudio>({
      maxRetries: 1,
      setTimeoutFn: vi.fn() as unknown as typeof setTimeout,
      clearTimeoutFn: vi.fn() as typeof clearTimeout,
    });
    const { context } = createRetryContext(session);

    session.scheduleRetry(context);
    session.scheduleRetry(context);
    session.scheduleRetry(context);
    session.scheduleRetry(context);

    expect(context.onPlaybackError).toHaveBeenCalledTimes(1);
    expect(session.retryCount).toBe(0);
  });
});

describe("PlaybackSession pending resume", () => {
  it("clamps pending resume to just before the duration", () => {
    const session = new PlaybackSession<PlaybackSessionAudio>({
      maxRetries: 1,
      setTimeoutFn: vi.fn() as unknown as typeof setTimeout,
      clearTimeoutFn: vi.fn() as typeof clearTimeout,
    });
    const audio = makeAudio({ currentTime: 240, duration: 120 });
    const { context } = createRetryContext(session, { audio });

    session.scheduleRetry(context);
    session.scheduleRetry(context);
    const applied = session.applyPendingResume(audio, {
      seekAudio: context.seekAudio,
      setStoreProgress: context.setStoreProgress,
    });

    expect(applied).toBe(119.9);
    expect(audio.currentTime).toBe(119.9);
    expect(context.setStoreProgress).toHaveBeenCalledWith(119);
  });

  it("suppresses progress updates until canplay finishes pending resume", () => {
    const session = new PlaybackSession<PlaybackSessionAudio>({
      maxRetries: 1,
      setTimeoutFn: vi.fn() as unknown as typeof setTimeout,
      clearTimeoutFn: vi.fn() as typeof clearTimeout,
    });
    const { context } = createRetryContext(session);

    session.scheduleRetry(context);
    session.scheduleRetry(context);

    expect(session.shouldSuppressProgressUpdate()).toBe(true);
    session.finishCanPlay();
    expect(session.shouldSuppressProgressUpdate()).toBe(false);
  });
});

describe("PlaybackSession event decisions", () => {
  it("skips pause events caused by source changes, effects, loops, and errors", () => {
    const session = new PlaybackSession<PlaybackSessionAudio>();

    session.beginSourceChange("song-1");
    expect(
      session.handlePauseEvent({
        ended: false,
        storeIsPlaying: true,
        hasAudioError: false,
      }),
    ).toEqual({ type: "skip", reason: "srcChanging" });

    session.beginEffectPause();
    expect(
      session.handlePauseEvent({
        ended: false,
        storeIsPlaying: false,
        hasAudioError: false,
      }),
    ).toEqual({ type: "skip", reason: "effectPausing" });

    session.markLoopRestarting();
    expect(
      session.handlePauseEvent({
        ended: false,
        storeIsPlaying: true,
        hasAudioError: false,
      }),
    ).toEqual({ type: "skip", reason: "loopRestarting" });

    const errorSession = new PlaybackSession<PlaybackSessionAudio>();
    expect(
      errorSession.handlePauseEvent({
        ended: false,
        storeIsPlaying: true,
        hasAudioError: true,
      }),
    ).toEqual({ type: "skip", reason: "audioError" });
  });

  it("forwards user-visible pause events", () => {
    const session = new PlaybackSession<PlaybackSessionAudio>();

    expect(
      session.handlePauseEvent({
        ended: false,
        storeIsPlaying: false,
        hasAudioError: false,
      }),
    ).toEqual({ type: "forward" });
  });

  it("decides repeat-one ended behavior separately from DOM events", () => {
    expect(
      getPlaybackEndedDecision({
        loopState: LoopState.One,
        songlist: makeSonglist(),
      }),
    ).toEqual({ type: "restart-current" });
    expect(
      getPlaybackEndedDecision({
        loopState: LoopState.One,
        songlist: makeSonglist({
          userQueue: { songs: [makeSong("queued")] },
        }),
      }),
    ).toEqual({
      type: "forward-ended",
      action: "playNext",
      hasNextInRepeatOne: true,
    });
    expect(
      getPlaybackEndedDecision({
        loopState: LoopState.All,
        songlist: makeSonglist(),
      }),
    ).toEqual({
      type: "forward-ended",
      action: "playNext",
      hasNextInRepeatOne: false,
    });
    expect(
      getPlaybackEndedDecision({
        loopState: LoopState.Off,
        songlist: makeSonglist(),
      }),
    ).toEqual({
      type: "forward-ended",
      action: "stop",
      hasNextInRepeatOne: false,
    });
  });
});

describe("audio progress helpers", () => {
  it("returns rounded finite duration", () => {
    expect(getAudioDurationSeconds(makeAudio({ duration: 120.4 }))).toBe(120);
    expect(getAudioDurationSeconds(makeAudio({ duration: Number.NaN }))).toBe(
      null,
    );
  });

  it("calculates buffered time and progress snapshots", () => {
    const audio = makeAudio({
      currentTime: 42.9,
      duration: 180,
      buffered: {
        length: 1,
        end: vi.fn(() => 90),
      },
    });

    expect(getBufferedTime(audio)).toBe(90);
    expect(getAudioProgressSnapshot(audio)).toEqual({
      progress: 42,
      bufferedProgress: 90,
    });
  });
});
