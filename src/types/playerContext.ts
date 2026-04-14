import {
  CurrentSongData,
  LanControlMessageType,
  PlayerStateData,
  QueueData,
  RemoteDeviceInfo,
} from "./lanControl";
import { Radio } from "./responses/radios";
import { ISong } from "./responses/song";

export enum LoopState {
  Off = 0,
  All = 1,
  One = 2,
}

export interface ISongList {
  shuffledList: ISong[];
  currentList: ISong[];
  currentSongIndex: number;
  currentSong: ISong;
  originalList: ISong[];
  originalSongIndex: number;
  radioList: Radio[];
  queueSource: string | null;
}

export type FullscreenPlayerTab = "queue" | "playing" | "lyrics";
export type DesktopFullscreenPanelView = "queue" | "lyrics" | null;

export interface IPlayerState {
  isPlaying: boolean;
  loopState: LoopState;
  isShuffleActive: boolean;
  isSongStarred: boolean;
  volume: number;
  currentDuration: number;
  mediaType: "song" | "radio";
  audioPlayerRef: HTMLAudioElement | null;
  mainDrawerState: boolean;
  queueState: boolean;
  lyricsState: boolean;
  fullscreenPlayerOpen: boolean;
  fullscreenPlayerTab: FullscreenPlayerTab;
  desktopFullscreenPanelView: DesktopFullscreenPanelView;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface IPlayerProgress {
  progress: number;
}

export interface IVolumeSettings {
  min: number;
  max: number;
  step: number;
  wheelStep: number;
}

export type ReplayGainType = "track" | "album";

interface IReplayGainData {
  enabled: boolean;
  type: ReplayGainType;
  preAmp: number;
  error: boolean;
  defaultGain: number;
}

interface IReplayGainActions {
  setReplayGainEnabled: (value: boolean) => void;
  setReplayGainType: (value: ReplayGainType) => void;
  setReplayGainPreAmp: (value: number) => void;
  setReplayGainError: (value: boolean) => void;
  setReplayGainDefaultGain: (value: number) => void;
}

interface IReplayGain {
  values: IReplayGainData;
  actions: IReplayGainActions;
}

interface IFullscreen {
  autoFullscreenEnabled: boolean;
  setAutoFullscreenEnabled: (value: boolean) => void;
}

interface ILyrics {
  preferSyncedLyrics: boolean;
  setPreferSyncedLyrics: (value: boolean) => void;
  showTranslation: boolean;
  setShowTranslation: (value: boolean) => void;
}

export interface IPrivacySettings {
  lrcLibEnabled: boolean;
  setLrcLibEnabled: (value: boolean) => void;
}

interface IQueueSettings {
  useSongColor: boolean;
}

interface IColorsSettings {
  currentSongColor: string | null;
  currentSongColorIntensity: number;
  queue: IQueueSettings;
}

export interface IPlayerSettings {
  volume: IVolumeSettings;
  fullscreen: IFullscreen;
  lyrics: ILyrics;
  replayGain: IReplayGain;
  privacy: IPrivacySettings;
  colors: IColorsSettings;
}

export interface IRemoteControlState {
  active: boolean;
  device: RemoteDeviceInfo | null;
  sendCommand: ((type: LanControlMessageType, data?: unknown) => void) | null;
}

export interface IPlayerActions {
  playSong: (song: ISong) => void;
  setSongList: (
    songlist: ISong[],
    index: number,
    shuffle?: boolean,
    sourceId?: { albumId: string } | { playlistId: string },
    sourceName?: string,
  ) => void;
  setCurrentSong: () => void;
  checkIsSongStarred: () => void;
  starSongInQueue: (id: string) => void;
  starCurrentSong: () => Promise<void>;
  setPlayingState: (status: boolean) => void;
  togglePlayPause: () => void;
  toggleLoop: () => void;
  toggleShuffle: () => void;
  checkActiveSong: (id: string) => boolean;
  playNextSong: () => void;
  playPrevSong: () => void;
  hasNextSong: () => boolean;
  hasPrevSong: () => boolean;
  isPlayingOneSong: () => boolean;
  clearPlayerState: () => void;
  resetProgress: () => void;
  setProgress: (progress: number) => void;
  setVolume: (volume: number) => void;
  handleVolumeWheel: (isScrollingDown: boolean) => void;
  setCurrentDuration: (duration: number) => void;
  setPlayRadio: (list: Radio[], index: number) => void;
  setAudioPlayerRef: (ref: HTMLAudioElement) => void;
  setNextOnQueue: (
    songlist: ISong[],
    sourceId?: { albumId: string } | { playlistId: string },
    sourceName?: string,
  ) => void;
  setLastOnQueue: (
    songlist: ISong[],
    sourceId?: { albumId: string } | { playlistId: string },
    sourceName?: string,
  ) => void;
  removeSongFromQueue: (id: string) => void;
  clearHistory: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  setMainDrawerState: (state: boolean) => void;
  setQueueState: (state: boolean) => void;
  toggleQueueAction: () => void;
  setLyricsState: (state: boolean) => void;
  toggleLyricsAction: () => void;
  toggleQueueAndLyrics: () => void;
  closeDrawer: () => void;
  openFullscreenPlayer: (tab?: FullscreenPlayerTab) => void;
  closeFullscreenPlayer: () => void;
  setFullscreenPlayerTab: (tab: FullscreenPlayerTab) => void;
  setDesktopFullscreenPanelView: (view: DesktopFullscreenPanelView) => void;
  playFirstSongInQueue: () => void;
  handleSongEnded: () => void;
  getCurrentProgress: () => number;
  resetConfig: () => void;
  updateQueueChecks: () => void;
  setCurrentSongColor: (value: string | null) => void;
  setCurrentSongIntensity: (value: number) => void;
  setUseSongColorOnQueue: (value: boolean) => void;
  enterRemoteControl: (device: RemoteDeviceInfo | null) => void;
  exitRemoteControl: () => void;
  registerRemoteSender: (
    sender: (type: LanControlMessageType, data?: unknown) => void,
  ) => void;
  clearRemoteSender: () => void;
  setRemotePlayerState: (state: PlayerStateData | null) => void;
  setRemoteCurrentSongData: (song: CurrentSongData | null) => void;
  setRemoteQueueData: (queue: QueueData | null) => void;
  setRemoteDevice: (device: RemoteDeviceInfo | null) => void;
}

export interface IPlayerContext {
  songlist: ISongList;
  playerState: IPlayerState;
  playerProgress: IPlayerProgress;
  settings: IPlayerSettings;
  remoteControl: IRemoteControlState;
  actions: IPlayerActions;
}
