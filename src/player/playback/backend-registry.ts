import type { PlaybackBackend } from "./types";

const registeredBackends = new WeakMap<HTMLAudioElement, PlaybackBackend>();

export function registerPlaybackBackend(
  audio: HTMLAudioElement,
  backend: PlaybackBackend,
) {
  registeredBackends.set(audio, backend);

  return () => {
    if (registeredBackends.get(audio) === backend) {
      registeredBackends.delete(audio);
    }
  };
}

export function getRegisteredPlaybackBackend(audio: HTMLAudioElement) {
  return registeredBackends.get(audio) ?? null;
}

export function seekPlaybackTarget(audio: HTMLAudioElement, seconds: number) {
  const backend = getRegisteredPlaybackBackend(audio);
  if (backend) {
    return backend.seek(seconds);
  }

  audio.currentTime = Math.max(0, seconds);
}
