import { shallow } from "zustand/shallow";
import type { IPlayerContext } from "@/types/playerContext";
import { hasElectronBridge } from "@/utils/desktop";
import { discordRpc } from "@/utils/discordRpc";
import { hasAnySongs } from "./queue-utils";

interface PlayerStoreApi {
  getState: () => IPlayerContext;
  subscribe: <T>(
    selector: (state: IPlayerContext) => T,
    listener: (selected: T, previous: T) => void,
    options?: { equalityFn?: (a: T, b: T) => boolean },
  ) => () => void;
}

const playerCleanupCallbacks: (() => void)[] = [];
let subscriptionsRegistered = false;

export function addPlayerCleanupCallback(callback: () => void) {
  playerCleanupCallbacks.push(callback);
}

export function cleanupPlayerStore() {
  for (const cb of playerCleanupCallbacks) cb();
  playerCleanupCallbacks.length = 0;
}

export function registerPlayerStoreSubscriptions(store: PlayerStoreApi) {
  if (subscriptionsRegistered) return;
  subscriptionsRegistered = true;

  store.subscribe(
    (state) => [
      state.songlist.contextQueue.songs,
      state.songlist.contextQueue.currentIndex,
      state.songlist.userQueue.songs,
      state.songlist.isInUserQueue,
      state.songlist.playedUserQueueHistory,
    ],
    () => {
      const playerStore = store.getState();
      const { mediaType } = playerStore.playerState;
      if (mediaType === "radio") return;

      playerStore.actions.checkIsSongStarred();
      playerStore.actions.setCurrentSong();

      const { progress } = playerStore.playerProgress;

      if (!hasAnySongs(playerStore.songlist) && progress > 0) {
        playerStore.actions.resetProgress();
      }
    },
    {
      equalityFn: shallow,
    },
  );

  store.subscribe(
    ({ songlist }) => [
      songlist.contextQueue.songs,
      songlist.userQueue.songs,
      songlist.contextQueue.currentIndex,
      songlist.isInUserQueue,
      songlist.playedUserQueueHistory,
      songlist.radioList,
    ],
    () => {
      store.getState().actions.updateQueueChecks();
    },
    {
      equalityFn: shallow,
    },
  );

  store.subscribe(
    (state) => [
      state.songlist.currentSong,
      state.playerState.isPlaying,
      state.playerState.currentDuration,
    ],
    () => {
      discordRpc.sendCurrentSong();
    },
    {
      equalityFn: shallow,
    },
  );

  registerDesktopStateListener(store);
  updateDesktopState(store);

  store.subscribe(
    (state) => [
      state.playerState.isPlaying,
      state.playerState.hasPrev,
      state.playerState.hasNext,
      state.songlist.contextQueue.songs,
      state.songlist.userQueue.songs,
    ],
    () => {
      updateDesktopState(store);
    },
    {
      equalityFn: shallow,
    },
  );
}

function registerDesktopStateListener(store: PlayerStoreApi) {
  if (!hasElectronBridge()) return;

  const {
    togglePlayPause,
    playPrevSong,
    playNextSong,
    toggleShuffle,
    toggleLoop,
  } = store.getState().actions;

  window.api.playerStateListener((action) => {
    if (action === "togglePlayPause") togglePlayPause();
    if (action === "skipBackwards") playPrevSong();
    if (action === "skipForward") playNextSong();
    if (action === "toggleShuffle") toggleShuffle();
    if (action === "toggleRepeat") toggleLoop();
  });
}

function updateDesktopState(store: PlayerStoreApi) {
  if (!hasElectronBridge()) return;

  const { isPlaying, hasPrev, hasNext } = store.getState().playerState;
  const { radioList, contextQueue, userQueue } = store.getState().songlist;

  const hasSongs =
    contextQueue.songs.length >= 1 || userQueue.songs.length >= 1;
  const hasRadios = radioList.length >= 1;

  window.api.updatePlayerState({
    isPlaying,
    hasPrevious: hasPrev,
    hasNext,
    hasSonglist: hasSongs || hasRadios,
  });
}
