import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { closestCenter, DndContext, DragOverlay } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueueDndSensors } from "@/app/components/queue/dnd-sensors";
import {
  ScrollArea,
  scrollAreaViewportSelector,
} from "@/app/components/ui/scroll-area";
import {
  usePlayerActions,
  usePlayerCurrentList,
  usePlayerCurrentSong,
  usePlayerCurrentSongIndex,
  usePlayerIsPlaying,
  useContextQueue,
  useUserQueue,
} from "@/store/player.store";
import { ISong } from "@/types/responses/song";
import { QueueItemRow, SortableQueueItem } from "./queue-item-row";

interface DraggableVirtualQueueProps {
  scrollAreaClassName?: string;
  thumbClassName?: string;
}

export function DraggableVirtualQueue({
  scrollAreaClassName = "w-full h-full overflow-auto",
  thumbClassName,
}: DraggableVirtualQueueProps) {
  const { setSongList, reorderQueue } = usePlayerActions();
  const currentList = usePlayerCurrentList();
  const currentSong = usePlayerCurrentSong();
  const currentSongIndex = usePlayerCurrentSongIndex();
  const isPlaying = usePlayerIsPlaying();
  const { contextIndex } = useContextQueue();
  const { userQueueSongs } = useUserQueue();
  const [activeItem, setActiveItem] = useState<ISong | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  const getScrollElement = useCallback(() => {
    if (!parentRef.current) return null;
    return parentRef.current.querySelector(scrollAreaViewportSelector);
  }, []);

  const virtualizer = useVirtualizer({
    count: currentList.length,
    getScrollElement,
    estimateSize: () => 64,
    overscan: 5,
  });

  useEffect(() => {
    if (currentSongIndex >= 0) {
      virtualizer.scrollToIndex(currentSongIndex, { align: "start" });
    }
  }, [currentSongIndex, virtualizer]);

  const sensors = useQueueDndSensors();

  const items = useMemo(
    () => currentList.map((song) => song.id),
    [currentList],
  );

  function handleDragStart(event: DragStartEvent) {
    const song = currentList.find((s) => s.id === event.active.id);
    setActiveItem(song ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = currentList.findIndex((s) => s.id === active.id);
    const toIndex = currentList.findIndex((s) => s.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;

    reorderQueue(fromIndex, toIndex);
  }

  const contextPlayedCount = contextIndex + 1;
  const userQueueStart = contextPlayedCount;
  const userQueueEnd = userQueueStart + userQueueSongs.length;

  if (currentList.length === 0) {
    return (
      <div className="flex flex-1 flex-col h-full min-w-0 items-center justify-center">
        <span>No songs in queue</span>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ScrollArea
          ref={parentRef}
          type="always"
          className={scrollAreaClassName}
          thumbClassName={thumbClassName}
          data-vaul-no-drag
        >
          <div
            className="px-2"
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const song = currentList[virtualRow.index];
              const isCurrent =
                currentSong?.id === song.id;
              const isInUserQueue =
                virtualRow.index >= userQueueStart &&
                virtualRow.index < userQueueEnd;

              return (
                <div
                  key={song.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {virtualRow.index === userQueueStart &&
                    userQueueSongs.length > 0 && (
                      <div className="flex items-center gap-2 px-1 py-0.5 mb-0.5">
                        <div className="h-px flex-1 bg-foreground/10" />
                        <span className="text-[10px] font-medium text-foreground/40 uppercase tracking-wider whitespace-nowrap">
                          Queue
                        </span>
                        <div className="h-px flex-1 bg-foreground/10" />
                      </div>
                    )}
                  <SortableQueueItem
                    id={song.id}
                    song={song}
                    isPlaying={isCurrent && isPlaying}
                    isActive={isCurrent}
                    tier={isInUserQueue ? "user" : "context"}
                    onPlay={() => {
                      if (!isCurrent) {
                        setSongList(currentList, virtualRow.index);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </SortableContext>
      {createPortal(
        <DragOverlay>
          {activeItem && (
            <QueueItemRow
              song={activeItem}
              isPlaying={currentSong?.id === activeItem.id && isPlaying}
              isActive={currentSong?.id === activeItem.id}
              onPlay={() => {}}
            />
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}