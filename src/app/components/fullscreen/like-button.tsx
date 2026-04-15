import { clsx } from "clsx";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { usePlayerActions, usePlayerSongStarred } from "@/store/player.store";
import { buttonsStyle } from "./controls";

interface LikeButtonProps {
  className?: string;
}

export function LikeButton({ className }: LikeButtonProps) {
  const { starCurrentSong } = usePlayerActions();
  const isSongStarred = usePlayerSongStarred();
  const { t } = useTranslation();

  const isOverride = className?.includes("size-");

  return (
    <Button
      size="icon"
      variant="ghost"
      className={clsx(!isOverride && buttonsStyle.secondary, className)}
      onClick={starCurrentSong}
      style={!isOverride ? { ...buttonsStyle.style } : undefined}
      aria-label={
        isSongStarred ? t("player.tooltips.unstar") : t("player.tooltips.star")
      }
    >
      <Heart
        className={clsx(
          isOverride ? "w-4 h-4" : "w-6 h-6",
          isSongStarred && "text-red-500 fill-red-500",
        )}
      />
    </Button>
  );
}
