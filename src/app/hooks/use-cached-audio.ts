import { getAudioSourceUrl } from "@/service/cache";
import { useAudioSource } from "./use-audio-source";

interface CachedAudioState {
  url: string;
  resolvedSongId: string | undefined;
  isCached: boolean;
  isLoading: boolean;
}

const INITIAL_STATE: CachedAudioState = {
  url: "",
  resolvedSongId: undefined,
  isCached: false,
  isLoading: false,
};

export function useCachedAudioUrl(songId?: string) {
  const { source, resolvedSongId, isCached, isLoading } =
    useAudioSource(songId);

  if (!source) return INITIAL_STATE;

  return {
    url: getAudioSourceUrl(source),
    resolvedSongId,
    isCached,
    isLoading,
  };
}
