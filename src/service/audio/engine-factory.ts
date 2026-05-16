import { NativeAudio } from "aonsoku-native-audio";
import { isCapacitorNative } from "@/service/platform";
import type { PlaybackEngine } from "./types";
import { CapacitorPlaybackEngine } from "./capacitor/capacitor-playback-engine";
import { WebPlaybackEngine } from "./web/web-playback-engine";

export function createPlaybackEngine(): PlaybackEngine {
  if (isCapacitorNative()) {
    return new CapacitorPlaybackEngine(NativeAudio);
  }
  return new WebPlaybackEngine();
}
