import clsx from "clsx";
import { MicVocalIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { SimpleTooltip } from "@/app/components/ui/simple-tooltip";
import { useHasLyrics } from "@/app/hooks/use-has-lyrics";
import { useIsXl } from "@/app/hooks/use-is-xl";
import {
  useFullscreenPlayerState,
  useLyricsState,
  useMainDrawerState,
} from "@/store/player.store";

interface PlayerLyricsButtonProps {
  disabled?: boolean;
}

export function PlayerLyricsButton({ disabled }: PlayerLyricsButtonProps) {
  const { t } = useTranslation();
  const { mainDrawerState } = useMainDrawerState();
  const { lyricsState, toggleLyricsAction } = useLyricsState();
  const { openFullscreenPlayer } = useFullscreenPlayerState();
  const isXl = useIsXl();
  const { hasLyrics } = useHasLyrics();

  const isLyricsDisabled = disabled || hasLyrics === false;
  const isActive = mainDrawerState && lyricsState;

  function handleClick() {
    if (isLyricsDisabled) return;
    if (isXl) {
      toggleLyricsAction();
    } else {
      openFullscreenPlayer("lyrics");
    }
  }

  return (
    <SimpleTooltip text={t("fullscreen.lyrics")}>
      <Button
        variant="ghost"
        size="icon"
        className={clsx(
          "rounded-full w-10 h-10 p-2 text-secondary-foreground relative",
          isActive && "player-button-active",
          isLyricsDisabled && "opacity-50 cursor-not-allowed",
        )}
        onClick={handleClick}
        disabled={isLyricsDisabled}
      >
        <MicVocalIcon className={clsx("w-4 h-4", isActive && "text-primary")} />
      </Button>
    </SimpleTooltip>
  );
}
