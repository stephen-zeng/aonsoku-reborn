import { createContext, useContext } from "react";
import { MiniPlayerState } from "@/utils/mini-player-sync";

export interface MiniPlayerContextValue {
  state: MiniPlayerState | null;
  actions: {
    togglePlayPause: () => void;
    playNextSong: () => void;
    playPrevSong: () => void;
    toggleShuffle: () => void;
    toggleLoop: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number) => void;
    starCurrentSong: () => void;
  };
}

export const MiniPlayerContext = createContext<MiniPlayerContextValue | null>(null);

export function useMiniPlayerContext() {
  const context = useContext(MiniPlayerContext);
  if (!context) {
    throw new Error("useMiniPlayerContext must be used within a MiniPlayerProvider");
  }
  return context;
}
