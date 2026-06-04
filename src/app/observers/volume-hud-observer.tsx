import { useEffect } from "react";
import { getNativeAudioPluginAvailability } from "@/native/audio/facade";
import { usePlayerStore } from "@/store/player.store";

export function VolumeHUDObserver() {
  const fullscreenPlayerOpen = usePlayerStore(
    (state) => state.playerState.fullscreenPlayerOpen,
  );

  useEffect(() => {
    const availability = getNativeAudioPluginAvailability();
    if (!availability.available) return;

    // Show system volume HUD when fullscreen player is closed.
    // Hide it when fullscreen player is open to use the app's custom volume bar.
    availability.plugin.setVolumeHUDEnabled({ enabled: !fullscreenPlayerOpen });

    return () => {
      // Ensure HUD is re-enabled when observer is unmounted.
      availability.plugin.setVolumeHUDEnabled({ enabled: true });
    };
  }, [fullscreenPlayerOpen]);

  return null;
}
