import { electronAPI } from "@electron-toolkit/preload";
import { contextBridge, ipcRenderer } from "electron";
import { IAonsokuAPI, IpcChannels, PlayerStateListenerActions } from "./types";

// Custom APIs for renderer
const api: IAonsokuAPI = {
  enterFullScreen: () => ipcRenderer.send(IpcChannels.ToggleFullscreen, true),
  exitFullScreen: () => ipcRenderer.send(IpcChannels.ToggleFullscreen, false),
  isFullScreen: () => ipcRenderer.invoke(IpcChannels.IsFullScreen),
  fullscreenStatusListener: (func) => {
    ipcRenderer.on(IpcChannels.FullscreenStatus, (_, status: boolean) =>
      func(status),
    );
  },
  removeFullscreenStatusListener: () => {
    ipcRenderer.removeAllListeners(IpcChannels.FullscreenStatus);
  },
  isMaximized: () => ipcRenderer.invoke(IpcChannels.IsMaximized),
  maximizedStatusListener: (func) => {
    ipcRenderer.on(IpcChannels.MaximizedStatus, (_, status: boolean) =>
      func(status),
    );
  },
  removeMaximizedStatusListener: () => {
    ipcRenderer.removeAllListeners(IpcChannels.MaximizedStatus);
  },
  toggleMaximize: (isMaximized) =>
    ipcRenderer.send(IpcChannels.ToggleMaximize, isMaximized),
  toggleMinimize: () => ipcRenderer.send(IpcChannels.ToggleMinimize),
  closeWindow: () => ipcRenderer.send(IpcChannels.CloseWindow),
  setTitleBarOverlayColors: (color) =>
    ipcRenderer.send(IpcChannels.ThemeChanged, color),
  setNativeTheme: (isDark) =>
    ipcRenderer.send(IpcChannels.UpdateNativeTheme, isDark),
  updatePlayerState: (payload) => {
    ipcRenderer.send(IpcChannels.UpdatePlayerState, payload);
  },
  playerStateListener: (func) => {
    ipcRenderer.on(
      IpcChannels.PlayerStateListener,
      (_, state: PlayerStateListenerActions) => func(state),
    );
  },
  setDiscordRpcActivity: (payload) => {
    ipcRenderer.send(IpcChannels.SetDiscordRpcActivity, payload);
  },
  clearDiscordRpcActivity: () => {
    ipcRenderer.send(IpcChannels.ClearDiscordRpcActivity);
  },
  saveAppSettings: (payload) => {
    ipcRenderer.send(IpcChannels.SaveAppSettings, payload);
  },
  // Mini Player
  openMiniPlayer: () => ipcRenderer.send(IpcChannels.OpenMiniPlayer),
  closeMiniPlayer: () => ipcRenderer.send(IpcChannels.CloseMiniPlayer),
  isMiniPlayerOpen: () => ipcRenderer.invoke(IpcChannels.IsMiniPlayerOpen),
  miniPlayerStatusListener: (func) => {
    ipcRenderer.on(IpcChannels.MiniPlayerStatus, (_, isOpen: boolean) =>
      func(isOpen),
    );
  },
  removeMiniPlayerStatusListener: () => {
    ipcRenderer.removeAllListeners(IpcChannels.MiniPlayerStatus);
  },
  setAlwaysOnTop: (isAlwaysOnTop) =>
    ipcRenderer.send(IpcChannels.SetAlwaysOnTop, isAlwaysOnTop),
  isAlwaysOnTop: () => ipcRenderer.invoke(IpcChannels.IsAlwaysOnTop),
  // LAN Control
  lanControl: {
    start: (config) => ipcRenderer.invoke(IpcChannels.LanControlStart, config),
    stop: () => ipcRenderer.invoke(IpcChannels.LanControlStop),
    getInfo: () => ipcRenderer.invoke(IpcChannels.LanControlGetInfo),
    updateConfig: (config) =>
      ipcRenderer.invoke(IpcChannels.LanControlUpdateConfig, config),
    broadcastState: (state) =>
      ipcRenderer.send(IpcChannels.LanControlBroadcastState, state),
    broadcastSong: (song) =>
      ipcRenderer.send(IpcChannels.LanControlBroadcastSong, song),
    broadcastQueue: (queue) =>
      ipcRenderer.send(IpcChannels.LanControlBroadcastQueue, queue),
    onMessage: (callback) => {
      ipcRenderer.on(IpcChannels.LanControlMessage, (_, message) =>
        callback(message),
      );
    },
    onRequestState: (callback) => {
      ipcRenderer.on(IpcChannels.LanControlRequestState, () => callback());
    },
    removeMessageListener: () => {
      ipcRenderer.removeAllListeners(IpcChannels.LanControlMessage);
    },
    removeRequestStateListener: () => {
      ipcRenderer.removeAllListeners(IpcChannels.LanControlRequestState);
    },
  },
  // App Update
  update: {
    checkForUpdates: () => ipcRenderer.invoke("app:check-for-updates"),
    getVersion: () => ipcRenderer.invoke("app:get-version"),
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI;
  // @ts-expect-error (define in dts)
  window.api = api;
}
