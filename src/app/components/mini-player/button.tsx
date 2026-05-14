import clsx from "clsx";
import { PictureInPicture2Icon } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { SimpleTooltip } from "@/app/components/ui/simple-tooltip";
import {
  usePipWindowOpen,
  usePlayerCurrentList,
  usePlayerStore,
} from "@/store/player.store";
import { hasElectronBridge } from "@/utils/desktop";
import {
  broadcastState,
  destroyMiniPlayerSync,
  handleControlAction,
  initMiniPlayerSync,
  listenControlActions,
} from "@/utils/mini-player-sync";
import { MiniPlayer } from "./player";
import { MiniPlayerPortal } from "./portal";

const MemoMiniPlayerPortal = memo(MiniPlayerPortal);
const MemoMiniPlayer = memo(MiniPlayer);

function MiniPlayerButtonWeb() {
  const { t } = useTranslation();
  const currentList = usePlayerCurrentList();
  const pipWindowOpen = usePipWindowOpen();
  const [pipWindow, setPipWindow] = useState<Window | null>(
    window.documentPictureInPicture.window,
  );

  useEffect(() => {
    if (!pipWindowOpen) return;
    if (pipWindow) return;

    let cancelled = false;

    window.documentPictureInPicture
      .requestWindow({ width: 300, height: 300 })
      .then((newWindow) => {
        if (cancelled) {
          newWindow.close();
          return;
        }

        const handlePageHide = () => {
          setPipWindow(null);
          usePlayerStore.getState().actions.closePipWindow();
        };

        newWindow.addEventListener("pagehide", handlePageHide);
        setPipWindow(newWindow);
      })
      .catch(() => {
        usePlayerStore.getState().actions.closePipWindow();
      });

    return () => {
      cancelled = true;
    };
  }, [pipWindowOpen, pipWindow]);

  useEffect(() => {
    if (!pipWindowOpen && pipWindow) {
      pipWindow.close();
      setPipWindow(null);
    }
  }, [pipWindowOpen, pipWindow]);

  useEffect(() => {
    const existingWindow = window.documentPictureInPicture.window;
    if (existingWindow) {
      setPipWindow(existingWindow);
      usePlayerStore.getState().actions.openPipWindow();
    }
  }, []);

  const handleClick = useCallback(() => {
    if (pipWindowOpen) {
      usePlayerStore.getState().actions.closePipWindow();
    } else {
      usePlayerStore.getState().actions.openPipWindow();
    }
  }, [pipWindowOpen]);

  const disabled = currentList.length === 0;

  const buttonTooltip = pipWindowOpen
    ? t("player.tooltips.miniPlayer.close")
    : t("player.tooltips.miniPlayer.open");

  return (
    <>
      <SimpleTooltip text={buttonTooltip}>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          className={clsx(
            "relative rounded-full",
            pipWindowOpen &&
              "text-primary hover-supported:text-primary player-button-active",
          )}
          disabled={disabled}
          unfocusable
        >
          <PictureInPicture2Icon className="w-4 h-4" />
        </Button>
      </SimpleTooltip>
      <MemoMiniPlayerPortal pipWindow={pipWindow}>
        <MemoMiniPlayer pipWindow={pipWindow} />
      </MemoMiniPlayerPortal>
    </>
  );
}

function MiniPlayerButtonDesktop() {
  const { t } = useTranslation();
  const currentList = usePlayerCurrentList();
  const pipWindowOpen = usePipWindowOpen();
  const [isMiniPlayerOpen, setIsMiniPlayerOpen] = useState(false);

  useEffect(() => {
    if (!hasElectronBridge()) return;

    window.api.isMiniPlayerOpen().then((open) => {
      setIsMiniPlayerOpen(open);
    });

    window.api.miniPlayerStatusListener((isOpen: boolean) => {
      setIsMiniPlayerOpen(isOpen);
      if (isOpen) {
        usePlayerStore.getState().actions.openPipWindow();
      } else {
        usePlayerStore.getState().actions.closePipWindow();
      }
    });

    return () => {
      window.api.removeMiniPlayerStatusListener();
    };
  }, []);

  useEffect(() => {
    if (isMiniPlayerOpen) {
      initMiniPlayerSync();
    } else {
      destroyMiniPlayerSync();
    }

    return () => {
      destroyMiniPlayerSync();
    };
  }, [isMiniPlayerOpen]);

  useEffect(() => {
    if (!isMiniPlayerOpen) return;

    const cleanup = listenControlActions(
      (action, value) => {
        handleControlAction(action, value);
      },
      () => {
        broadcastState();
      },
    );

    return cleanup;
  }, [isMiniPlayerOpen]);

  const handleClick = useCallback(() => {
    if (!hasElectronBridge()) return;

    if (pipWindowOpen || isMiniPlayerOpen) {
      window.api.closeMiniPlayer();
      usePlayerStore.getState().actions.closePipWindow();
    } else {
      window.api.openMiniPlayer();
      usePlayerStore.getState().actions.openPipWindow();
    }
  }, [pipWindowOpen, isMiniPlayerOpen]);

  const disabled = currentList.length === 0;

  const buttonTooltip =
    pipWindowOpen || isMiniPlayerOpen
      ? t("player.tooltips.miniPlayer.close")
      : t("player.tooltips.miniPlayer.open");

  return (
    <SimpleTooltip text={buttonTooltip}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        className={clsx(
          "relative rounded-full",
          (pipWindowOpen || isMiniPlayerOpen) &&
            "text-primary hover-supported:text-primary player-button-active",
        )}
        disabled={disabled}
        unfocusable
      >
        <PictureInPicture2Icon className="w-4 h-4" />
      </Button>
    </SimpleTooltip>
  );
}

export function MiniPlayerButton() {
  if (hasElectronBridge()) {
    return <MiniPlayerButtonDesktop />;
  }

  return <MiniPlayerButtonWeb />;
}
