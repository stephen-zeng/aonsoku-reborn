import {
  usePlayerCurrentList,
  usePlayerCurrentSong,
  usePlayerCurrentSongIndex,
  usePlayerIsPlaying,
} from "@/store/player.store";
import { QueueSourceLabel } from "./queue-source-label";
import { DraggableVirtualQueue } from "./draggable-virtual-queue";

export function QueueSongList() {
  const currentList = usePlayerCurrentList();
  const currentSongIndex = usePlayerCurrentSongIndex();
  const currentSong = usePlayerCurrentSong();
  const isPlaying = usePlayerIsPlaying();

  if (currentList.length === 0) {
    return (
      <div className="flex flex-1 flex-col h-full min-w-0 items-center justify-center">
        <span>No songs in queue</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-full min-w-0">
      <QueueSourceLabel />
      <DraggableVirtualQueue
        currentList={currentList}
        currentSong={currentSong}
        currentSongIndex={currentSongIndex}
        isPlaying={isPlaying}
      />
    </div>
  );
}
