import type { PluginListenerHandle } from "@capacitor/core";
import { getNativeAudioPluginAvailability } from "@/native/audio/facade";
import type {
  NativeAudioEvents,
  NativeAudioPlugin,
  NativeQueueSong,
} from "@/native/audio/types";
import { usePlayerStore } from "@/store/player.store";
import { getCurrentSong } from "@/store/player/queue-utils";
import { LoopState } from "@/types/playerContext";
import type { QueueSourceId } from "@/types/playerContext";
import type { Radio } from "@/types/responses/radios";
import type { ISong } from "@/types/responses/song";
import { logger } from "@/utils/logger";
import type {
  QueueController,
  QueueControllerEvent,
  QueueControllerListener,
  QueueControllerState,
} from "./types";

function loopStateToNative(state: LoopState): "off" | "one" | "all" {
  switch (state) {
    case LoopState.Off:
      return "off";
    case LoopState.All:
      return "all";
    case LoopState.One:
      return "one";
  }
}

function songToNativeQueueSong(song: ISong): NativeQueueSong {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    artistId: song.artistId,
    album: song.album,
    albumId: song.albumId,
    duration: song.duration,
    coverArtId: song.coverArt,
    streamUrl: song.id,
  };
}

export class NativeQueueController implements QueueController {
  #plugin: NativeAudioPlugin;
  #listeners: Map<
    QueueControllerEvent,
    Set<QueueControllerListener<QueueControllerEvent>>
  > = new Map();
  #nativeListenerHandles: PluginListenerHandle[] = [];
  #disposed = false;

  constructor() {
    const availability = getNativeAudioPluginAvailability();
    if (!availability.available) {
      throw new Error("NativeQueueController requires native audio plugin");
    }
    this.#plugin = availability.plugin;
    this.#wireNativeEvents();
  }

  setSongList(
    songs: ISong[],
    index: number,
    shuffle?: boolean,
    sourceId?: QueueSourceId | { albumId: string } | { playlistId: string },
    _sourceName?: string,
  ): void {
    const nativeSongs = songs.map(songToNativeQueueSong);
    const loopState = usePlayerStore.getState().playerState.loopState;

    this.#plugin
      .setContextQueue({
        songs: nativeSongs,
        currentIndex: Math.max(0, Math.min(index, songs.length - 1)),
        autoplay: true,
        repeatMode: loopStateToNative(loopState),
      })
      .then(() => {
        if (shuffle) {
          return this.#plugin.setShuffle({ enabled: true });
        }
      })
      .catch((err) =>
        logger.error("[NativeQueueController] setSongList failed", err),
      );

    const clampedIndex = Math.max(0, Math.min(index, songs.length - 1));
    usePlayerStore.setState((state) => {
      state.playerState.isPlaying = true;
      state.playerState.mediaType = "song";
      state.playerProgress.progress = 0;
      state.playerProgress.bufferedProgress = 0;
      state.songlist.isShuffleActive = Boolean(shuffle);
      state.songlist.contextQueue.songs = songs;
      state.songlist.contextQueue.currentIndex = clampedIndex;
      state.songlist.currentSong = songs[clampedIndex] ?? null;
      state.songlist.userQueue = { songs: [] };
      state.songlist.isInUserQueue = false;
      state.songlist.playedUserQueueHistory = [];
      state.playerState.currentDuration = songs[clampedIndex]?.duration
        ? Math.round(songs[clampedIndex].duration)
        : 0;
    });
  }

  playFromQueue(contextSongs: ISong[], contextIndex: number): void {
    this.#plugin
      .playAtIndex({ index: contextIndex })
      .catch((err) =>
        logger.error("[NativeQueueController] playFromQueue failed", err),
      );

    usePlayerStore.setState((state) => {
      state.playerState.isPlaying = true;
    });
  }

  playFromUserQueue(_userQueueIndex: number): void {
    logger.info("[NativeQueueController] playFromUserQueue not yet supported");
  }

  playSong(song: ISong, _sourceName?: string): void {
    this.setSongList([song], 0);
  }

  playNext(): void {
    this.#plugin
      .skipToNext()
      .catch((err) =>
        logger.error("[NativeQueueController] playNext failed", err),
      );
  }

  playPrev(): void {
    this.#plugin
      .skipToPrevious()
      .catch((err) =>
        logger.error("[NativeQueueController] playPrev failed", err),
      );
  }

  toggleShuffle(): void {
    const current = usePlayerStore.getState().songlist.isShuffleActive;
    this.#plugin
      .setShuffle({ enabled: !current })
      .catch((err) =>
        logger.error("[NativeQueueController] toggleShuffle failed", err),
      );

    usePlayerStore.setState((state) => {
      state.songlist.isShuffleActive = !current;
    });
  }

  setLoopState(state: LoopState): void {
    this.#plugin
      .setRepeatMode({ mode: loopStateToNative(state) })
      .catch((err) =>
        logger.error("[NativeQueueController] setLoopState failed", err),
      );

    usePlayerStore.setState((s) => {
      s.playerState.loopState = state;
    });
  }

  toggleLoop(): void {
    const current = usePlayerStore.getState().playerState.loopState;
    const next = ((current + 1) % 3) as LoopState;
    this.setLoopState(next);
  }

  play(): void {
    this.#plugin
      .play()
      .catch((err) => logger.error("[NativeQueueController] play failed", err));
    usePlayerStore.setState((state) => {
      state.playerState.isPlaying = true;
    });
  }

  pause(): void {
    this.#plugin
      .pause()
      .catch((err) =>
        logger.error("[NativeQueueController] pause failed", err),
      );
    usePlayerStore.setState((state) => {
      state.playerState.isPlaying = false;
    });
  }

  togglePlayPause(): void {
    const isPlaying = usePlayerStore.getState().playerState.isPlaying;
    if (isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(seconds: number): void {
    this.#plugin
      .seek({ position: Math.max(0, seconds) })
      .catch((err) => logger.error("[NativeQueueController] seek failed", err));

    usePlayerStore.setState((state) => {
      state.playerProgress.progress = seconds;
    });
  }

  setVolume(_volume: number): void {
    // iOS does not support programmatic volume control
  }

  setPlayRadio(_list: Radio[], _index: number): void {
    logger.info(
      "[NativeQueueController] setPlayRadio: delegating to legacy path",
    );
  }

  addToQueueNext(songs: ISong[]): void {
    const nativeSongs = songs.map(songToNativeQueueSong);
    this.#plugin
      .addToUserQueue({ songs: nativeSongs, position: "next" })
      .catch((err) =>
        logger.error("[NativeQueueController] addToQueueNext failed", err),
      );
  }

  addToQueueLast(songs: ISong[]): void {
    const nativeSongs = songs.map(songToNativeQueueSong);
    this.#plugin
      .addToUserQueue({ songs: nativeSongs, position: "last" })
      .catch((err) =>
        logger.error("[NativeQueueController] addToQueueLast failed", err),
      );
  }

  removeFromQueue(id: string, _tier?: "context" | "user"): void {
    logger.info(`[NativeQueueController] removeFromQueue: ${id}`);
  }

  reorderQueue(_fromIndex: number, _toIndex: number): void {
    logger.info("[NativeQueueController] reorderQueue");
  }

  clearUserQueue(): void {
    this.#plugin
      .clearUserQueue()
      .catch((err) =>
        logger.error("[NativeQueueController] clearUserQueue failed", err),
      );
  }

  clearPlayerState(): void {
    this.#plugin
      .clear()
      .catch((err) =>
        logger.error("[NativeQueueController] clear failed", err),
      );
  }

  handleSongEnded(): void {
    // Native handles this internally
  }

  hasNextSong(): boolean {
    return true;
  }

  hasPrevSong(): boolean {
    return true;
  }

  getState(): QueueControllerState {
    const store = usePlayerStore.getState();
    const { songlist, playerState, playerProgress } = store;
    return {
      currentSong: getCurrentSong(songlist),
      contextQueue: {
        songs: songlist.contextQueue.songs,
        currentIndex: songlist.contextQueue.currentIndex,
        sourceId: songlist.contextQueue.sourceId,
        sourceName: songlist.contextQueue.sourceName,
      },
      userQueue: songlist.userQueue.songs,
      isInUserQueue: songlist.isInUserQueue,
      isShuffleActive: songlist.isShuffleActive,
      loopState: playerState.loopState,
      isPlaying: playerState.isPlaying,
      progress: playerProgress.progress,
      duration: playerState.currentDuration,
      mediaType: playerState.mediaType,
    };
  }

  subscribe<T extends QueueControllerEvent>(
    event: T,
    listener: QueueControllerListener<T>,
  ): () => void {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    const set = this.#listeners.get(event)!;
    set.add(listener as QueueControllerListener<QueueControllerEvent>);
    return () => {
      set.delete(listener as QueueControllerListener<QueueControllerEvent>);
    };
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const handle of this.#nativeListenerHandles) {
      handle.remove();
    }
    this.#nativeListenerHandles = [];
    this.#listeners.clear();
  }

  async syncFromNative(): Promise<void> {
    try {
      const state = await this.#plugin.getFullState();
      usePlayerStore.setState((s) => {
        s.playerState.isPlaying = state.isPlaying;
        s.playerProgress.progress = state.currentTime;
        s.playerProgress.bufferedProgress = state.currentTime;
        s.playerState.currentDuration = state.duration;

        if (state.currentSongId) {
          const song = s.songlist.contextQueue.songs.find(
            (song) => song.id === state.currentSongId,
          );
          if (song) {
            s.songlist.currentSong = song;
            s.songlist.contextQueue.currentIndex =
              state.contextQueue.currentIndex;
          }
        }

        s.songlist.isInUserQueue = state.isInUserQueue;
        s.songlist.isShuffleActive = state.isShuffleActive;

        switch (state.loopState) {
          case "off":
            s.playerState.loopState = LoopState.Off;
            break;
          case "one":
            s.playerState.loopState = LoopState.One;
            break;
          case "all":
            s.playerState.loopState = LoopState.All;
            break;
        }
      });
    } catch (err) {
      logger.error("[NativeQueueController] syncFromNative failed", err);
    }
  }

  #wireNativeEvents() {
    this.#addNativeListener("queueStateChanged", (event) => {
      logger.info(
        `[NativeQueueController] queueStateChanged: index=${event.currentIndex} song=${event.songId} reason=${event.reason}`,
      );

      usePlayerStore.setState((state) => {
        state.songlist.contextQueue.currentIndex = event.currentIndex;
        state.playerProgress.progress = 0;
        state.playerProgress.bufferedProgress = 0;
        state.playerState.isPlaying = true;

        const song = state.songlist.contextQueue.songs.find(
          (s) => s.id === event.songId,
        );
        if (song) {
          state.songlist.currentSong = song;
          state.playerState.currentDuration = song.duration
            ? Math.round(song.duration)
            : 0;
        }
      });
    });

    this.#addNativeListener("progress", (event) => {
      if (usePlayerStore.getState().playerProgress.isScrubbing) return;
      usePlayerStore.setState((state) => {
        state.playerProgress.progress = event.currentTime;
        state.playerState.currentDuration = event.duration;
        if (event.bufferedTime !== undefined) {
          state.playerProgress.bufferedProgress = event.bufferedTime;
        }
      });
    });

    this.#addNativeListener("playbackStateChanged", (event) => {
      if (event.state === "playing") {
        usePlayerStore.setState((s) => {
          s.playerState.isPlaying = true;
          s.playerState.isBuffering = false;
        });
      } else if (event.state === "paused" || event.state === "stopped") {
        usePlayerStore.setState((s) => {
          s.playerState.isPlaying = false;
        });
      } else if (event.state === "loading") {
        usePlayerStore.setState((s) => {
          s.playerState.isBuffering = true;
        });
      }
    });

    this.#addNativeListener("bufferingChanged", (event) => {
      usePlayerStore.setState((s) => {
        s.playerState.isBuffering = event.isBuffering;
      });
    });
  }

  #addNativeListener<TEvent extends keyof NativeAudioEvents>(
    event: TEvent,
    listener: (payload: NativeAudioEvents[TEvent]) => void,
  ) {
    this.#plugin
      .addListener(event, listener)
      .then((handle) => {
        if (this.#disposed) {
          handle.remove();
        } else {
          this.#nativeListenerHandles.push(handle);
        }
      })
      .catch((err) =>
        logger.error(
          `[NativeQueueController] addListener(${event}) failed`,
          err,
        ),
      );
  }
}
