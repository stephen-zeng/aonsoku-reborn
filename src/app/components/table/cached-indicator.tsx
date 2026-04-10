import { CircleArrowDown } from "lucide-react";
import { useIsAudioCached } from "@/store/cache-index.store";

export function CachedIndicator({ songId }: { songId: string }) {
  const isCached = useIsAudioCached(songId);

  if (!isCached) return null;

  return (
    <CircleArrowDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
  );
}
