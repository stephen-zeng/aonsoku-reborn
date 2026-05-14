import { is } from "@electron-toolkit/utils";
import { BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { IpcChannels } from "../preload/types";
import { mainWindow } from "./window";

let miniPlayerWindow: BrowserWindow | null = null;

export function getMiniPlayerWindow(): BrowserWindow | null {
  return miniPlayerWindow;
}

export function createMiniPlayerWindow(): BrowserWindow | null {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.focus();
    return miniPlayerWindow;
  }

  const parent = mainWindow;

  if (!parent || parent.isDestroyed()) return null;

  miniPlayerWindow = new BrowserWindow({
    width: 300,
    height: 300,
    minWidth: 250,
    minHeight: 65,
    maxWidth: 600,
    maxHeight: 600,
    frame: false,
    alwaysOnTop: false,
    resizable: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: "#060e23",
    parent: parent,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
    },
  });

  miniPlayerWindow.on("closed", () => {
    miniPlayerWindow = null;
    if (parent && !parent.isDestroyed()) {
      parent.webContents.send(IpcChannels.MiniPlayerStatus, false);
    }
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    miniPlayerWindow.loadURL(
      `${process.env.ELECTRON_RENDERER_URL}#/mini-player`,
    );
  } else {
    miniPlayerWindow.loadFile(join(__dirname, "../renderer/index.html"), {
      hash: "/mini-player",
    });
  }

  miniPlayerWindow.once("ready-to-show", () => {
    miniPlayerWindow?.show();
    if (parent && !parent.isDestroyed()) {
      parent.webContents.send(IpcChannels.MiniPlayerStatus, true);
    }
  });

  return miniPlayerWindow;
}

export function closeMiniPlayerWindow(): void {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.close();
  }
  miniPlayerWindow = null;
}

export function setupMiniPlayerIpc(): void {
  ipcMain.on(IpcChannels.OpenMiniPlayer, () => {
    createMiniPlayerWindow();
  });

  ipcMain.on(IpcChannels.CloseMiniPlayer, () => {
    closeMiniPlayerWindow();
  });

  ipcMain.removeHandler(IpcChannels.IsMiniPlayerOpen);
  ipcMain.handle(IpcChannels.IsMiniPlayerOpen, () => {
    return miniPlayerWindow != null && !miniPlayerWindow.isDestroyed();
  });
}

export function destroyMiniPlayerWindow(): void {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.destroy();
  }
  miniPlayerWindow = null;
}
