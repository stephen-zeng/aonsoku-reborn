import { isCapacitorNative } from "@/service/platform";
import type { PlaybackEngine } from "./types";
import { WebPlaybackEngine } from "./web/web-playback-engine";

export function createPlaybackEngine(): PlaybackEngine {
  if (isCapacitorNative()) {
    // TODO: return CapacitorPlaybackEngine once implemented
    return new WebPlaybackEngine();
  }
  return new WebPlaybackEngine();
}
