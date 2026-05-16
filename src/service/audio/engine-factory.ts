import { NativeAudio } from "aonsoku-native-audio";
import { isCapacitorNative } from "@/service/platform";
import type { PlaybackEngine } from "./types";
import { CapacitorPlaybackEngine } from "./capacitor/capacitor-playback-engine";
import { WebPlaybackEngine } from "./web/web-playback-engine";

export async function createPlaybackEngine(): Promise<PlaybackEngine> {
  if (isCapacitorNative()) {
    const engine = new CapacitorPlaybackEngine(NativeAudio);
    await engine.initialize();
    return engine;
  }
  const engine = new WebPlaybackEngine();
  await engine.initialize();
  return engine;
}
