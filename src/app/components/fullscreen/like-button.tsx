import { clsx } from "clsx";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { useFullscreenContrast } from "@/app/hooks/use-fullscreen-contrast";
import { usePlayerActions, usePlayerSongStarred } from "@/store/player.store";

interface LikeButtonProps {
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export function LikeButton({ className, onClick }: LikeButtonProps) {
  const { starCurrentSong } = usePlayerActions();
  const isSongStarred = usePlayerSongStarred();
  const { t } = useTranslation();
  const { hoverBg } = useFullscreenContrast();

  const isOverride = className?.includes("size-");

  return (
    <Button
      size="icon"
      variant="ghost"
      className={clsx(
        !isOverride && "relative w-11 h-11 md:w-12 md:h-12 rounded-full",
        !isOverride && hoverBg,
        !isOverride && "text-foreground",
        className,
      )}
      onClick={onClick ?? starCurrentSong}
      style={isOverride ? undefined : { backfaceVisibility: "hidden" }}
      aria-label={
        isSongStarred ? t("player.tooltips.unstar") : t("player.tooltips.star")
      }
    >
      <Heart
        className={clsx(
          isOverride ? "w-4 h-4" : "w-6 h-6",
          isSongStarred ? "text-red-500 fill-red-500" : "text-foreground/70",
        )}
      />
    </Button>
  );
}