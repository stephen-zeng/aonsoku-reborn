export function isValidDuration(duration: unknown): duration is number {
  return (
    typeof duration === "number" && Number.isFinite(duration) && duration > 0
  );
}

export function clampProgress(progress: number, duration: number): number {
  if (!isValidDuration(duration)) return 0;
  if (progress < 0) return 0;
  if (progress > duration) return duration;
  return progress;
}
