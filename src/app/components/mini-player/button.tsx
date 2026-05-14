import clsx from "clsx";
import { PictureInPicture2Icon } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { SimpleTooltip } from "@/app/components/ui/simple-tooltip";
import { usePlayerCurrentList, usePlayerStore, usePipWindowOpen } from "@/store/player.store";
import { MiniPlayer } from "./player";
import { MiniPlayerPortal } from "./portal";

const MemoMiniPlayerPortal = memo(MiniPlayerPortal);
const MemoMiniPlayer = memo(MiniPlayer);

export function MiniPlayerButton() {
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