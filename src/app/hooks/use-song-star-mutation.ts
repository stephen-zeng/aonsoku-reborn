import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlayerStore } from "@/store/player.store";
import { subsonic } from "@/service/subsonic";
import { libraryDb, withStarredAt } from "@/store/library-db";
import type { ISong } from "@/types/responses/song";
import { queryKeys } from "@/utils/queryKeys";

interface UseSongStarMutationOptions {
  songId: string;
  initialStarred: boolean;
  albumId?: string;
  song?: ISong;
}

export function useSongStarMutation({
  songId,
  initialStarred,
  albumId,
  song,
}: UseSongStarMutationOptions) {
  const [isStarred, setIsStarred] = useState(initialStarred);

  useEffect(() => {
    setIsStarred(initialStarred);
  }, [initialStarred]);

  const queryClient = useQueryClient();

  const starMutation = useMutation({
    mutationFn: subsonic.star.handleStarItem,
    onSuccess: async (_data, variables) => {
      const nextStarred = !variables.starred;
      const starredAt = nextStarred ? new Date().toISOString() : undefined;

      if (song) {
        await libraryDb.songs.put(
          withStarredAt({
            ...song,
            starred: starredAt,
          }),
        );
      } else {
        await libraryDb.songs.update(songId, {
          starred: starredAt,
          starredAt: nextStarred ? Date.now() : undefined,
        });
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.song.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.favorites.count,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.favorites.list,
      });
      if (albumId) {
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.album.single, albumId],
        });
      }
    },
  });

  function toggleStar() {
    if (starMutation.isPending) return;

    const newState = !isStarred;
    setIsStarred(newState);

    starMutation.mutate(
      { id: songId, starred: newState },
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
