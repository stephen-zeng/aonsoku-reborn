import { EqualizerBars } from "@/app/components/icons/equalizer-bars";
import {
  usePlayerActions,
  usePlayerIsPlaying,
  usePlayerMediaType,
  usePlayerSonglist,
} from "@/store/player.store";

interface PlaySongButtonProps {
  trackNumber: number;
  trackId: string;
}

export default function PlaySongButton({
  trackNumber,
  trackId,
}: PlaySongButtonProps) {
  const { checkActiveSong } = usePlayerActions();
  const { isSong, isRadio } = usePlayerMediaType();
  const isPlaying = usePlayerIsPlaying();
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
    <div className="w-full h-full text-center text-foreground flex items-center justify-center">
      <div className="w-8 h-8 flex items-center justify-center">
        {isActive && isPlaying ? (
          <EqualizerBars size={18} className="mb-1" />
        ) : (
          <span className={isActive ? "text-primary" : ""}>{trackNumber}</span>
        )}
      </div>
    </div>
  );
}
