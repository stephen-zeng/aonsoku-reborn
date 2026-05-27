import { useEffect } from "react";
import { useCurrentLyricLine } from "@/app/hooks/use-current-lyric-line";
import { usePipWindowOpen } from "@/store/player.store";
import { hasElectronBridge } from "@/utils/desktop";
import {
  broadcastState,
  destroyMiniPlayerSync,
  handleControlAction,
  initMiniPlayerSync,
  listenControlActions,
  setCurrentLine,
} from "@/utils/mini-player-sync";

/**
 * Global observer to handle Miniplayer synchronization for both Web and Electron.
 */
export function MiniPlayerSyncObserver() {
  const pipWindowOpen = usePipWindowOpen();
  const { currentLine } = useCurrentLyricLine();

  // Handle Electron sync initialization
  useEffect(() => {
    if (!hasElectronBridge()) return;

    if (pipWindowOpen) {
      initMiniPlayerSync();

      const cleanup = listenControlActions(
        (action, value) => {
          handleControlAction(action, value);
        },
        () => {
          broadcastState();
        },
      );

      return () => {
        cleanup();
        destroyMiniPlayerSync();
      };
    }
  }, [pipWindowOpen]);

  // Sync lyrics whenever they change
  useEffect(() => {
    if (pipWindowOpen) {
      setCurrentLine(currentLine);
      broadcastState();
    }
  }, [currentLine, pipWindowOpen]);

  return null;
}
