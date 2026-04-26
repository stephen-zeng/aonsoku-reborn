import {
  usePlayerCurrentSong,
  usePlayerCurrentSongIndex,
  useHasQueueSongs,
  usePlayerCurrentList,
} from "@/store/player.store";
import { AppTitle } from "./header/app-title";

export function HeaderSongInfo() {
  const currentSong = usePlayerCurrentSong();
  const currentSongIndex = usePlayerCurrentSongIndex();
  const hasQueue = useHasQueueSongs();
  const currentList = usePlayerCurrentList();

  function formatSongCount() {
    const currentPosition = currentSongIndex + 1;
    const listLength = currentList.length;

    return `[${currentPosition}/${listLength}]`;
  }

  function getCurrentSongInfo() {
    if (!currentSong) return "";
    return `${currentSong.artist} - ${currentSong.title}`;
  }

  return (
    <div className="col-span-2 flex justify-center items-center">
      {!hasQueue && <AppTitle />}
      {hasQueue && (
        <div className="flex w-full justify-center subpixel-antialiased font-medium text-sm text-muted-foreground">
          <p className="leading-7 mr-1">{formatSongCount()}</p>
          <p className="leading-7 truncate">{getCurrentSongInfo()}</p>
        </div>
      )}
    </div>
  );
}
