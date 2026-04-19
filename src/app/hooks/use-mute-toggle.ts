import { useCallback, useRef } from "react";
import { usePlayerVolume } from "@/store/player.store";

export function useMuteToggle() {
  const { volume, setVolume } = usePlayerVolume();
  const lastVolumeRef = useRef(volume > 0 ? volume : 100);

  const handleMuteClick = useCallback(() => {
    if (volume === 0) {
      const volumeSafety =
        lastVolumeRef.current >= 1 ? lastVolumeRef.current : 100;
      setVolume(volumeSafety);
    } else {
      lastVolumeRef.current = volume;
      setVolume(0);
    }
  }, [volume, setVolume]);

  return { volume, handleMuteClick, lastVolumeRef };
}
