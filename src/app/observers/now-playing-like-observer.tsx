import { useEffect } from "react";
import { getNativeAudioPluginAvailability } from "@/native/audio/facade";
import { usePlayerSongStarred } from "@/store/player.store";

export function NowPlayingLikeObserver() {
  const isSongStarred = usePlayerSongStarred();

  useEffect(() => {
    const availability = getNativeAudioPluginAvailability();
    if (!availability.available) return;

    availability.plugin.setLikeActive({ active: isSongStarred });
  }, [isSongStarred]);

  return null;
}
