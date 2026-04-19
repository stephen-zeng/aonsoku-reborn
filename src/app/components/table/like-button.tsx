import { clsx } from "clsx";
import { Heart } from "lucide-react";
import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useHasHover } from "@/app/hooks/use-input-mode";
import { Button } from "@/app/components/ui/button";
import { useSongStarMutation } from "@/app/hooks/use-song-star-mutation";
import { subsonic } from "@/service/subsonic";
import {
  usePlayerCurrentSong,
  usePlayerSongStarred,
} from "@/store/player.store";
import { queryKeys } from "@/utils/queryKeys";

interface TableLikeButtonProps {
  type: "song" | "artist";
  starred: boolean;
  entityId: string;
  albumId?: string;
}

export function TableLikeButton({
  entityId,
  starred,
  type,
  albumId,
}: TableLikeButtonProps) {
  const songStar = useSongStarMutation({
    songId: entityId,
    initialStarred: starred,
    albumId,
  });

  const currentSong = usePlayerCurrentSong();
  const isSongStarred = usePlayerSongStarred();

  useEffect(() => {
    if (type === "artist") return;
    if (currentSong.id === entityId) {
      songStar.setIsStarred(isSongStarred);
    }
  }, [currentSong, entityId, isSongStarred, type, songStar.setIsStarred]);

  const queryClient = useQueryClient();

  const artistStarMutation = useMutation({
    mutationFn: subsonic.star.handleStarItem,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [queryKeys.artist.single, entityId],
      });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.favorites.count],
      });
    },
  });

  function handleStarred() {
    if (type === "song") {
      songStar.toggleStar();
      return;
    }

    artistStarMutation.mutate(
      { id: entityId, starred },
      {
        onError: () => {
          queryClient.invalidateQueries({
            queryKey: [queryKeys.artist.single, entityId],
          });
        },
      },
    );
  }

  const isStarred = type === "song" ? songStar.isStarred : starred;
  const hasHover = useHasHover();

  return (
    <Button
      variant="ghost"
      disabled={songStar.isPending || artistStarMutation.isPending}
      className={clsx(
        "w-8 h-8 p-1 rounded-full transition-opacity",
        !isStarred && "opacity-0 group-hover/tablerow:opacity-100",
        !hasHover && "opacity-100",
      )}
      onClick={(e) => {
        e.stopPropagation();
        handleStarred();
      }}
    >
      <Heart
        className={clsx("w-4 h-4", isStarred && "text-red-500 fill-red-500")}
        strokeWidth={2}
      />
    </Button>
  );
}
