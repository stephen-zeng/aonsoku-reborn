import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlayerStore } from "@/store/player.store";
import { subsonic } from "@/service/subsonic";
import { queryKeys } from "@/utils/queryKeys";

interface UseSongStarMutationOptions {
  songId: string;
  initialStarred: boolean;
  albumId?: string;
}

export function useSongStarMutation({
  songId,
  initialStarred,
  albumId,
}: UseSongStarMutationOptions) {
  const [isStarred, setIsStarred] = useState(initialStarred);

  useEffect(() => {
    setIsStarred(initialStarred);
  }, [initialStarred]);

  const queryClient = useQueryClient();

  const starMutation = useMutation({
    mutationFn: subsonic.star.handleStarItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.song.all] });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.favorites.count],
      });
      if (albumId) {
        queryClient.invalidateQueries({
          queryKey: [queryKeys.album.single, albumId],
        });
      }
    },
  });

  function toggleStar() {
    if (starMutation.isPending) return;

    const newState = !isStarred;
    setIsStarred(newState);

    starMutation.mutate(
      { id: songId, starred: isStarred },
      {
        onSuccess: () => {
          const { mediaType } = usePlayerStore.getState().playerState;
          if (mediaType !== "song") return;

          const { currentList } = usePlayerStore.getState().songlist;
          const isCurrentSong = currentList.some((s) => s.id === songId);
          if (isCurrentSong) {
            usePlayerStore.getState().actions.starSongInQueue(songId);
          }
        },
        onError: () => {
          setIsStarred(!newState);
        },
      },
    );
  }

  return {
    isStarred,
    setIsStarred,
    toggleStar,
    isPending: starMutation.isPending,
  };
}
