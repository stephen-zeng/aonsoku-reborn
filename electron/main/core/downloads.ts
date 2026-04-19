import { app, BrowserWindow, ipcMain } from "electron";
import { download } from "electron-dl";
import { IpcChannels } from "../../preload/types";

/**
 * Native "Save file" export path.
 *
 * This is intentionally separate from the Cache API–backed download
 * machinery in `src/service/cache/cache-manager.ts`. The "Save file"
 * menu entry writes a raw copy of the audio into the user's
 * Downloads folder (usable by external players, iPod sync, backup
 * workflows, etc.); it does NOT participate in the offline cache,
 * does NOT appear in the storage settings stats, and is never
 * evicted by this application.
 *
 * The decision to keep this path alongside the cache is recorded in
 * docs/offline-architecture.md (P7.4 / Appendix A).
 */

export interface IDownloadPayload {
  url: string;
  fileId: string;
}

export function setupDownloads(window: BrowserWindow | null) {
  ipcMain.on(
    IpcChannels.HandleDownloads,
    async (_, payload: IDownloadPayload) => {
      if (!window) return;

      const { url, fileId } = payload;

      try {
        const downloadsPath = app.getPath("downloads");

        await download(window, url, {
          directory: downloadsPath,
          onCompleted: () => {
            window.webContents.send(IpcChannels.DownloadCompleted, fileId);
          },
        });
      } catch {
        window.webContents.send(IpcChannels.DownloadFailed, fileId);
      }
    },
  );
}
