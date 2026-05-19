import { useCallback, useRef } from "react";
import { usePlayerVolume } from "@/store/player.store";
import { getPlaybackCapabilities } from "@/utils/capabilities";
import { useSystemVolume } from "./use-system-volume";

export function useMuteToggle() {
  const { volume: playerVolume, setVolume } = usePlayerVolume();
  const {
    volume: systemVolume,
    setSystemVolume,
    supportsSystemVolumeControl,
  } = useSystemVolume();
  const volume = supportsSystemVolumeControl ? systemVolume : playerVolume;
  const lastVolumeRef = useRef(volume > 0 ? volume : 100);

  const handleMuteClick = useCallback(() => {
    const canSetVolume =
      supportsSystemVolumeControl || getPlaybackCapabilities().canSetVolume;
    if (!canSetVolume) return;

    const applyVolume = supportsSystemVolumeControl
      ? setSystemVolume
      : setVolume;

    if (volume === 0) {
      const volumeSafety =
        lastVolumeRef.current >= 1 ? lastVolumeRef.current : 100;
      applyVolume(volumeSafety);
    } else {
      lastVolumeRef.current = volume;
      applyVolume(0);
    }
  }, [setSystemVolume, setVolume, supportsSystemVolumeControl, volume]);

  return { volume, handleMuteClick, lastVolumeRef };
}
