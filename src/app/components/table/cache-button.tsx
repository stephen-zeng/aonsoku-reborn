import { clsx } from "clsx";
import { CircleArrowDown, Trash2 } from "lucide-react";
import { DownloadingIndicator } from "@/app/components/table/cached-indicator";
import { Button } from "@/app/components/ui/button";
import { useHasHover } from "@/app/hooks/use-input-mode";
import { useSongCacheState } from "@/app/hooks/use-song-cache";

interface CacheButtonProps {
  songId: string;
  groupName?: string;
}

export function CacheButton({
  songId,
  groupName = "tablerow",
}: CacheButtonProps) {
  const { isCached, isLoading, progress, cache, remove } =
    useSongCacheState(songId);
  const hasHover = useHasHover();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isLoading}
      className={clsx(
        "w-8 h-8 p-1 rounded-full transition-opacity",
        !isCached && `opacity-0 group-hover-supported/${groupName}:opacity-100`,
        !hasHover && "opacity-100",
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (isCached) {
          remove();
        } else {
          cache();
        }
      }}
      unfocusable
    >
      {isLoading ? (
        <DownloadingIndicator progress={progress} className="w-4 h-4" />
      ) : isCached ? (
        <Trash2 className="w-4 h-4 text-muted-foreground hover-supported:text-destructive" />
      ) : (
        <CircleArrowDown className="w-4 h-4 text-muted-foreground" />
      )}
    </Button>
  );
}
