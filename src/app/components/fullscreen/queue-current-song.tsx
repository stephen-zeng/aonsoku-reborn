import { clsx } from "clsx";
import { EllipsisVertical, Repeat, Shuffle } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { getCoverArtUrl } from "@/api/httpClient";
import RepeatOne from "@/app/components/icons/repeat-one";
import { QueueMenuOptions } from "@/app/components/queue/queue-menu-options";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { LikeButton } from "@/app/components/fullscreen/like-button";
import {
  usePlayerActions,
  usePlayerLoop,
  usePlayerShuffle,
  usePlayerStore,
} from "@/store/player.store";
import { LoopState } from "@/types/playerContext";

export const QueueCurrentSong = memo(function QueueCurrentSong() {
  const currentSong = usePlayerStore((state) => state.songlist.currentSong);
  const coverArtUrl = getCoverArtUrl(currentSong.coverArt, "song", "100");

  return (
    <div className="py-2">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded overflow-hidden shrink-0 bg-accent">
          <img
            src={coverArtUrl}
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
        <LikeButton className="shrink-0 size-8 rounded-full" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 size-8 rounded-full"
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

  const isRepeatActive = loopState !== LoopState.Off;

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={toggleShuffle}
        aria-pressed={isShuffleActive}
        className={clsx(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
          isShuffleActive
            ? "bg-foreground/15 text-foreground"
            : "text-foreground/60 border border-foreground/30 hover:text-foreground hover:bg-foreground/10",
        )}
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
        className={clsx(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
          isRepeatActive
            ? "bg-foreground/15 text-foreground"
            : "text-foreground/60 border border-foreground/30 hover:text-foreground hover:bg-foreground/10",
        )}
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
