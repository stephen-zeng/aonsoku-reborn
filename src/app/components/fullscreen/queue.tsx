import { DraggableVirtualQueue } from "@/app/components/queue/draggable-virtual-queue";
import {
  usePlayerCurrentList,
  usePlayerCurrentSong,
  usePlayerCurrentSongIndex,
  usePlayerIsPlaying,
} from "@/store/player.store";

export function FullscreenSongQueue() {
  const currentList = usePlayerCurrentList();
  const currentSongIndex = usePlayerCurrentSongIndex();
  const currentSong = usePlayerCurrentSong();
  const isPlaying = usePlayerIsPlaying();

  if (currentList.length === 0) {
    return (
      <div className="flex justify-center items-center">
        <span>No songs in queue</span>
      </div>
    );
  }

  return (
    <DraggableVirtualQueue
      currentList={currentList}
      currentSong={currentSong}
      currentSongIndex={currentSongIndex}
      isPlaying={isPlaying}
      scrollAreaClassName="min-h-full h-full overflow-auto"
      thumbClassName="secondary-thumb-bar"
    />
  );
}
