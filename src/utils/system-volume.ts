import { getNativeAudioPluginAvailability } from "@/native/audio/facade";
import { getPlaybackCapabilities } from "@/utils/capabilities";

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function volumeFromNative(value: number): number {
  return clampVolume(value * 100);
}

export function canUseSystemVolumeControl(): boolean {
  if (!getPlaybackCapabilities().supportsSystemVolumeControl) return false;
  return getNativeAudioPluginAvailability().available;
}

let currentSystemVolume = 100;

export function getCurrentSystemVolume(): number {
  return currentSystemVolume;
}

export function setCurrentSystemVolume(value: number): void {
  currentSystemVolume = clampVolume(value);
}

export async function setSystemVolume(value: number): Promise<void> {
  if (!canUseSystemVolumeControl()) return;
  const availability = getNativeAudioPluginAvailability();
  if (!availability.available) return;
  const clamped = clampVolume(value);
  currentSystemVolume = clamped;
  await availability.plugin.setSystemVolume({ value: clamped / 100 });
}

export async function getSystemVolume(): Promise<number> {
  if (!canUseSystemVolumeControl()) return 100;
  const availability = getNativeAudioPluginAvailability();
  if (!availability.available) return 100;
  const result = await availability.plugin.getSystemVolume();
  const volume = volumeFromNative(result.volume);
  currentSystemVolume = volume;
  return volume;
}
