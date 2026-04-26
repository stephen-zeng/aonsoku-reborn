import { HotkeyCallback, Keys, useHotkeys } from "react-hotkeys-hook";
import { usePlayerStore } from "@/store/player.store";

export function usePlayerHotkeys() {
  const hasSongs = usePlayerStore(
    (state) =>
      state.songlist.contextQueue.songs.length > 0 ||
      state.songlist.userQueue.songs.length > 0,
  );

  const useAudioHotkeys = (keys: Keys, callback: HotkeyCallback) => {
    useHotkeys(keys, callback, {
      preventDefault: true,
      enabled: hasSongs,
    });
  };

  return {
    useAudioHotkeys,
  };
}
