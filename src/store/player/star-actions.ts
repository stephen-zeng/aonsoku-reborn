import type { Draft } from "immer";
import { subsonic } from "@/service/subsonic";
import type { IPlayerActions, IPlayerContext } from "@/types/playerContext";
import { applyStarToAllLists, hasAnySongs } from "./queue-utils";

interface SharedDeps {
  set: (fn: (state: Draft<IPlayerContext>) => void) => void;
  get: () => IPlayerContext;
}

export function createStarActions(shared: SharedDeps) {
  const { set, get } = shared;

  return {
    starSongInQueue: (id: string) => {
      const {
        contextQueue,
        userQueue,
        originalContextSongs,
        playedUserQueueHistory,
      } = get().songlist;
      const { mediaType } = get().playerState;

      if (
        contextQueue.songs.length === 0 &&
        userQueue.songs.length === 0 &&
        mediaType !== "song"
      )
        return;

      let found = false;
      let newStarred: string | undefined;

      for (const list of [
        contextQueue.songs,
        userQueue.songs,
        playedUserQueueHistory,
        originalContextSongs,
      ]) {
        const song = list.find((s) => s.id === id);
        if (song && !found) {
          found = true;
          newStarred =
            typeof song.starred === "string"
              ? undefined
              : new Date().toISOString();
        }
      }

      if (!found) return;

      set((state) => {
        applyStarToAllLists(state.songlist, id, newStarred);
      });
    },

    starCurrentSong: async () => {
      const sl = get().songlist;
      const { mediaType } = get().playerState;

      if (!hasAnySongs(sl) && mediaType !== "song") return;

      const currentSong = get().songlist.currentSong;
      if (!currentSong) return;

      const { id, starred } = currentSong;
      const isSongStarred = typeof starred === "string";

      await subsonic.star.handleStarItem({
        id,
        starred: isSongStarred,
      });

      const afterSong = get().songlist.currentSong;
      if (!afterSong || afterSong.id !== id) return;

      const newStarred = isSongStarred ? undefined : new Date().toISOString();

      set((state) => {
        applyStarToAllLists(state.songlist, id, newStarred);
        state.playerState.isSongStarred = !isSongStarred;
      });
    },
  } satisfies Partial<IPlayerActions>;
}
