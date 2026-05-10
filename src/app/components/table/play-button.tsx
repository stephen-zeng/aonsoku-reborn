import {
  usePlayerActions,
  usePlayerMediaType,
  usePlayerSonglist,
} from "@/store/player.store";
import { cn } from "@/lib/utils";

interface PlaySongButtonProps {
  trackNumber: number;
  trackId: string;
  disabled?: boolean;
}

export default function PlaySongButton({
  trackNumber,
  trackId,
  disabled,
}: PlaySongButtonProps) {
  const { checkActiveSong } = usePlayerActions();
  const { isSong, isRadio } = usePlayerMediaType();
  const { radioList, currentSongIndex } = usePlayerSonglist();

  const isCurrentSongPlaying = () => {
    if (isSong) {
      return checkActiveSong(trackId);
    }
    if (isRadio) {
      return radioList[currentSongIndex].id === trackId;
    }

    return false;
  };

  const isActive = isCurrentSongPlaying();

  return (
    <div
      className={cn(
        "w-full h-full text-center text-foreground flex items-center justify-center",
        disabled && "text-muted-foreground opacity-50",
      )}
    >
      <div className="w-8 h-8 flex items-center justify-center">
        <span className={isActive && !disabled ? "text-primary" : ""}>
          {trackNumber}
        </span>
      </div>
    </div>
  );
}
