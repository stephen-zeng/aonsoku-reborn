import { clsx } from "clsx";
import { EllipsisVertical, Repeat, Shuffle } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { CachedImage } from "@/app/components/cover-image/cached-image";
import { LikeButton } from "@/app/components/fullscreen/like-button";
import RepeatOne from "@/app/components/icons/repeat-one";
import { QueueMenuOptions } from "@/app/components/queue/queue-menu-options";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useFullscreenContrast } from "@/app/hooks/use-fullscreen-contrast";
import {
  usePlayerActions,
  usePlayerLoop,
  usePlayerShuffle,
  usePlayerStore,
} from "@/store/player.store";
import { LoopState } from "@/types/playerContext";

export const QueueCurrentSong = memo(function QueueCurrentSong({
  onClick,
}: {
  onClick?: () => void;
}) {
  const currentSong = usePlayerStore(
    (state) => state.songlist.currentSong,
    (a, b) => a?.id === b?.id,
  );
  const { hoverBg10 } = useFullscreenContrast();

  if (!currentSong) return null;

  return (
    <div className={clsx("pt-2 pb-0.5 px-2 rounded-lg")} onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded overflow-hidden shrink-0 bg-accent">
          <CachedImage
            coverArtId={currentSong.coverArt}
            coverArtType="song"
            albumId={currentSong.albumId}
            className="w-12 h-12 object-cover"
            alt={`${currentSong.title} - ${currentSong.artist}`}
          />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-semibold text-sm truncate">
            {currentSong.title}
          </span>
          <span className="text-xs text-foreground/70 truncate">
            {currentSong.artist}
          </span>
        </div>
        <LikeButton
          className="shrink-0 size-8 rounded-full"
          onClick={(e) => e.stopPropagation()}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`shrink-0 size-8 rounded-full ${hoverBg10}`}
              onClick={(e) => e.stopPropagation()}
            >
              <EllipsisVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <QueueMenuOptions variant="dropdown" song={currentSong} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

export const QueueModeButtons = memo(function QueueModeButtons() {
  const isShuffleActive = usePlayerShuffle();
  const loopState = usePlayerLoop();
  const { toggleShuffle, toggleLoop } = usePlayerActions();
  const { t } = useTranslation();
  const { isBackdropDark } = useFullscreenContrast();

  const isRepeatActive = loopState !== LoopState.Off;

  const activeBtn = clsx(
    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
    isBackdropDark
      ? "bg-white/15 text-white"
      : "bg-foreground/15 text-foreground",
  );

  const inactiveBtn = clsx(
    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
    isBackdropDark
      ? "text-white/60 border border-white/30 hover-supported:text-white hover-supported:bg-white/10"
      : "text-foreground/60 border border-foreground/30 hover-supported:text-foreground hover-supported:bg-foreground/10",
  );

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={toggleShuffle}
        aria-pressed={isShuffleActive}
        className={isShuffleActive ? activeBtn : inactiveBtn}
      >
        <Shuffle className="w-3 h-3" />
        {isShuffleActive
          ? t("player.tooltips.shuffle.disable")
          : t("player.tooltips.shuffle.enable")}
      </button>
      <button
        type="button"
        onClick={toggleLoop}
        aria-pressed={isRepeatActive}
        className={isRepeatActive ? activeBtn : inactiveBtn}
      >
        {loopState === LoopState.One ? (
          <RepeatOne size={12} />
        ) : (
          <Repeat className="w-3 h-3" />
        )}
        {isRepeatActive
          ? t("player.tooltips.repeat.disable")
          : loopState === LoopState.One
            ? t("player.tooltips.repeat.enableOne")
            : t("player.tooltips.repeat.enable")}
      </button>
    </div>
  );
});
