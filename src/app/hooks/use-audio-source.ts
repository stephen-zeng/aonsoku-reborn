import { useCallback, useEffect, useRef, useState } from "react";
import {
  audioSourceResolver,
  type AudioSourceDescriptor,
  isCachedAudioSource,
  revokeAudioSource,
} from "@/service/cache";

interface AudioSourceState {
  source: AudioSourceDescriptor | null;
  resolvedSongId: string | undefined;
  isCached: boolean;
  isLoading: boolean;
}

const INITIAL_STATE: AudioSourceState = {
  source: null,
  resolvedSongId: undefined,
  isCached: false,
  isLoading: false,
};

export function useAudioSource(songId?: string): AudioSourceState {
  const [state, setState] = useState<AudioSourceState>(INITIAL_STATE);
  const sourceRef = useRef<AudioSourceDescriptor | null>(null);

  const revokePreviousSource = useCallback(() => {
    revokeAudioSource(sourceRef.current);
    sourceRef.current = null;
  }, []);

  useEffect(() => {
    if (!songId) {
      revokePreviousSource();
      setState(INITIAL_STATE);
      return;
    }

    let cancelled = false;
    setState((current) => ({
      ...current,
      isLoading: true,
    }));

    (async () => {
      const source = await audioSourceResolver.resolveSongSource(songId);
      if (cancelled) {
        revokeAudioSource(source);
        return;
      }

      revokePreviousSource();
      sourceRef.current = source;
      setState({
        source,
        resolvedSongId: songId,
        isCached: isCachedAudioSource(source),
        isLoading: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [songId, revokePreviousSource]);

  useEffect(() => {
    return () => {
      revokePreviousSource();
    };
  }, [revokePreviousSource]);

  return state;
}
