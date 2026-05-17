import type { ISongList } from "@/types/playerContext";
import { LoopState } from "@/types/playerContext";
import { transitionHandleSongEnded } from "@/store/player/queue-transitions";

export const MAX_PLAYBACK_RETRIES = 5;

export interface PlaybackSessionAudio {
  currentTime: number;
  duration: number;
  src: string;
  error?: MediaError | null;
  buffered: Pick<TimeRanges, "length" | "end">;
}

export interface PlaybackSessionSourceChange {
  cancelledRetry: boolean;
  retryCount: number;
}

export interface PlaybackRetryContext<TAudio extends PlaybackSessionAudio> {
  audio: TAudio;
  getCurrentAudio: () => TAudio | null;
  getStoreProgress: () => number;
  setStoreProgress: (progress: number) => void;
  isOnline: () => boolean;
  shouldResume: () => boolean;
  loadAudio: (audio: TAudio) => void;
  seekAudio: (audio: TAudio, seconds: number) => void;
  playAudio: (audio: TAudio, contextLabel: string) => void;
  onPlaybackError?: () => void;
}

export type PlaybackRetryResult =
  | { type: "offline" }
  | { type: "scheduled"; attempt: number; delay: number; resumePosition: number }
  | { type: "rangeFallback"; fallbackPosition: number }
  | { type: "failed" };

export type PlaybackRetrySkipReason =
  | "offline"
  | "generationChanged"
  | "audioMissing"
  | "sourceChanged"
  | "playbackStopped";

export interface PlaybackRetryEvent {
  type: "retry" | "skipped";
  reason?: PlaybackRetrySkipReason;
}

export type PlaybackPauseDecision =
  | { type: "skip"; reason: "loopRestarting" | "ended" | "srcChanging" | "effectPausing" | "audioError" }
  | { type: "forward" };

export interface PlaybackEndedInput {
  loopState: LoopState;
  songlist: ISongList;
}

export type PlaybackEndedDecision =
  | { type: "restart-current" }
  | {
      type: "forward-ended";
      action: "playNext" | "stop";
      hasNextInRepeatOne: boolean;
    };

export class PlaybackSession<TAudio extends PlaybackSessionAudio> {
  readonly #maxRetries: number;
  readonly #setTimeoutFn: typeof setTimeout;
  readonly #clearTimeoutFn: typeof clearTimeout;
  #retryTimeout: ReturnType<typeof setTimeout> | null = null;
  #retryCount = 0;
  #retryGeneration = 0;
  #pendingResumePosition: number | null = null;
  #resumeGuardActive = false;
  #playPromise: Promise<void> | null = null;
  #effectPausing = false;
  #srcChanging = false;
  #loopRestarting = false;
  #syncPlayHandled = false;
  #loadedSourceId: string | undefined;
  #rangeFallback = false;

  constructor(
    options: {
      maxRetries?: number;
      setTimeoutFn?: typeof setTimeout;
      clearTimeoutFn?: typeof clearTimeout;
    } = {},
  ) {
    this.#maxRetries = options.maxRetries ?? MAX_PLAYBACK_RETRIES;
    this.#setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    this.#clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  }

  get retryCount() {
    return this.#retryCount;
  }

  get hasRetryTimer() {
    return this.#retryTimeout !== null;
  }

  get pendingResumePosition() {
    return this.#pendingResumePosition;
  }

  get loadedSourceId() {
    return this.#loadedSourceId;
  }

  get sourceChanging() {
    return this.#srcChanging;
  }

  get loopRestarting() {
    return this.#loopRestarting;
  }

  get syncPlayHandled() {
    return this.#syncPlayHandled;
  }

  get resumeGuardActive() {
    return this.#resumeGuardActive;
  }

  beginSourceChange(
    sourceId?: string,
    options: { resumePosition?: number } = {},
  ): PlaybackSessionSourceChange {
    const result = {
      cancelledRetry: this.#retryTimeout !== null,
      retryCount: this.#retryCount,
    };

    this.cancelRetry();
    this.#retryCount = 0;
    this.#rangeFallback = false;
    this.#playPromise = null;
    this.#srcChanging = true;
    this.#loadedSourceId = sourceId;

    if (options.resumePosition) {
      this.#pendingResumePosition = options.resumePosition;
      this.#resumeGuardActive = true;
    }

    return result;
  }

  clearRetryTimer() {
    if (!this.#retryTimeout) return;
    this.#clearTimeoutFn(this.#retryTimeout);
    this.#retryTimeout = null;
  }

  cancelRetry() {
    this.clearRetryTimer();
    this.#retryGeneration += 1;
    this.#pendingResumePosition = null;
    this.#resumeGuardActive = false;
  }

  resetRetries() {
    this.cancelRetry();
    this.#retryCount = 0;
    this.#rangeFallback = false;
  }

  dispose() {
    this.cancelRetry();
    this.#retryCount = 0;
    this.#rangeFallback = false;
    this.#playPromise = null;
  }

  setPlayPromise(promise: Promise<void> | null) {
    this.#playPromise = promise;
  }

  clearPlayPromise(promise: Promise<void>) {
    if (this.#playPromise === promise) {
      this.#playPromise = null;
    }
  }

  consumePlayPromise() {
    const promise = this.#playPromise;
    this.#playPromise = null;

    return promise;
  }

  beginEffectPause() {
    this.#effectPausing = true;
  }

  clearEffectPauseIfPaused(isPaused: boolean) {
    if (isPaused) {
      this.#effectPausing = false;
    }
  }

  markLoopRestarting() {
    this.#loopRestarting = true;
  }

  markLoopRestartSyncHandled() {
    this.#syncPlayHandled = true;
  }

  consumeSyncPlayHandled() {
    const handled = this.#syncPlayHandled;
    this.#syncPlayHandled = false;

    return handled;
  }

  hasLoadedSource(sourceId?: string) {
    return sourceId === this.#loadedSourceId;
  }

  markPlaySuccess() {
    this.#retryCount = 0;
    this.#rangeFallback = false;
    this.clearRetryTimer();
    this.#resumeGuardActive = false;
  }

  handlePlayEvent() {
    this.#loopRestarting = false;
    this.markPlaySuccess();
  }

  handlePauseEvent(input: {
    ended: boolean;
    storeIsPlaying: boolean;
    hasAudioError: boolean;
  }): PlaybackPauseDecision {
    if (this.#loopRestarting || input.ended) {
      if (this.#srcChanging) {
        this.#srcChanging = false;
      }

      return {
        type: "skip",
        reason: this.#loopRestarting ? "loopRestarting" : "ended",
      };
    }

    if (this.#srcChanging) {
      this.#srcChanging = false;
      return { type: "skip", reason: "srcChanging" };
    }

    if (this.#effectPausing) {
      this.#effectPausing = false;
      return { type: "skip", reason: "effectPausing" };
    }

    if (input.storeIsPlaying && input.hasAudioError) {
      return { type: "skip", reason: "audioError" };
    }

    return { type: "forward" };
  }

  scheduleRetry(
    context: PlaybackRetryContext<TAudio>,
    onRetryEvent?: (event: PlaybackRetryEvent) => void,
  ): PlaybackRetryResult {
    if (!context.isOnline()) {
      this.cancelRetry();
      return { type: "offline" };
    }

    if (this.#retryCount >= this.#maxRetries) {
      if (!this.#rangeFallback) {
        this.#rangeFallback = true;
        this.#retryCount = 0;
        const fallbackPosition = Math.max(
          context.audio.currentTime,
          context.getStoreProgress(),
        );
        this.#pendingResumePosition = fallbackPosition;
        this.#resumeGuardActive = true;
        context.seekAudio(context.audio, 0);
        context.setStoreProgress(0);
        context.loadAudio(context.audio);
        context.playAudio(context.audio, "RangeFallback");
        return { type: "rangeFallback", fallbackPosition };
      }

      context.onPlaybackError?.();
      this.#retryCount = 0;
      this.cancelRetry();
      return { type: "failed" };
    }

    this.cancelRetry();

    const resumePosition = this.#rangeFallback
      ? 0
      : Math.max(context.audio.currentTime, context.getStoreProgress());
    this.#pendingResumePosition = resumePosition;
    this.#resumeGuardActive = true;
    this.#retryCount += 1;

    const attempt = this.#retryCount;
    const delay = Math.pow(2, attempt - 1) * 1000;
    const retryGeneration = this.#retryGeneration;
    const currentSrc = context.audio.src;

    this.#retryTimeout = this.#setTimeoutFn(() => {
      if (!context.isOnline()) {
        this.cancelRetry();
        onRetryEvent?.({ type: "skipped", reason: "offline" });
        return;
      }

      const currentAudio = context.getCurrentAudio();
      const skipReason = getRetrySkipReason({
        retryGeneration,
        currentGeneration: this.#retryGeneration,
        currentAudio,
        expectedSrc: currentSrc,
        shouldResume: context.shouldResume(),
      });

      if (skipReason) {
        if (this.#retryGeneration === retryGeneration) {
          this.#pendingResumePosition = null;
          this.#resumeGuardActive = false;
        }
        onRetryEvent?.({ type: "skipped", reason: skipReason });
        return;
      }

      context.loadAudio(currentAudio);
      context.playAudio(currentAudio, "Retry");
      onRetryEvent?.({ type: "retry" });
    }, delay);

    return { type: "scheduled", attempt, delay, resumePosition };
  }

  applyPendingResume(
    audio: TAudio,
    deps: {
      seekAudio: (audio: TAudio, seconds: number) => void;
      setStoreProgress: (progress: number) => void;
    },
  ) {
    const resumePosition = this.#pendingResumePosition;
    if (resumePosition === null) return null;

    const duration = audio.duration;
    const clampedPosition =
      Number.isFinite(duration) && duration > 0
        ? Math.min(resumePosition, duration - 0.1)
        : resumePosition;

    deps.seekAudio(audio, clampedPosition);
    deps.setStoreProgress(Math.floor(clampedPosition));

    return clampedPosition;
  }

  shouldSuppressProgressUpdate() {
    return this.#resumeGuardActive;
  }

  finishCanPlay() {
    this.#pendingResumePosition = null;
    this.#resumeGuardActive = false;
  }
}

function getRetrySkipReason<TAudio extends PlaybackSessionAudio>(input: {
  retryGeneration: number;
  currentGeneration: number;
  currentAudio: TAudio | null;
  expectedSrc: string;
  shouldResume: boolean;
}): PlaybackRetrySkipReason | null {
  if (input.retryGeneration !== input.currentGeneration) {
    return "generationChanged";
  }
  if (!input.currentAudio) return "audioMissing";
  if (input.currentAudio.src !== input.expectedSrc) return "sourceChanged";
  if (!input.shouldResume) return "playbackStopped";

  return null;
}

export function getPlaybackEndedDecision({
  loopState,
  songlist,
}: PlaybackEndedInput): PlaybackEndedDecision {
  const transition = transitionHandleSongEnded(songlist, loopState);

  if (transition.action === "seekToStart") {
    return { type: "restart-current" };
  }

  return {
    type: "forward-ended",
    action: transition.action,
    hasNextInRepeatOne:
      loopState === LoopState.One && transition.action === "playNext",
  };
}

export function getAudioDurationSeconds(audio: PlaybackSessionAudio) {
  const duration = audio.duration;

  return Number.isFinite(duration) && duration > 0
    ? Math.round(duration)
    : null;
}

export function getBufferedTime(audio: PlaybackSessionAudio) {
  if (audio.buffered.length === 0) return 0;

  const duration =
    Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;

  return Math.min(audio.buffered.end(audio.buffered.length - 1), duration);
}

export function getAudioProgressSnapshot(audio: PlaybackSessionAudio) {
  return {
    progress: Math.floor(audio.currentTime),
    bufferedProgress: getBufferedTime(audio),
  };
}
