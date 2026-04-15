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
import { usePlayerActions } from "@/store/player.store";
import { ISong } from "@/types/responses/song";
import { QueueItemRow, SortableQueueItem } from "./queue-item-row";

interface DraggableVirtualQueueProps {
  currentList: ISong[];
  currentSong: ISong;
  currentSongIndex: number;
  isPlaying: boolean;
  scrollAreaClassName?: string;
  thumbClassName?: string;
}

export function DraggableVirtualQueue({
  currentList,
  currentSong,
  currentSongIndex,
  isPlaying,
  scrollAreaClassName = "w-full h-full overflow-auto",
  thumbClassName,
}: DraggableVirtualQueueProps) {
  const { setSongList, reorderQueue } = usePlayerActions();
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
              const isCurrent = currentSong.id === song.id;
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
                  <SortableQueueItem
                    id={song.id}
                    song={song}
                    isPlaying={isCurrent && isPlaying}
                    isActive={isCurrent}
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
      {/* Portal escapes Vaul drawer's transform that breaks position:fixed */}
      {createPortal(
        <DragOverlay>
          {activeItem && (
            <QueueItemRow
              song={activeItem}
              isPlaying={currentSong.id === activeItem.id && isPlaying}
              isActive={currentSong.id === activeItem.id}
              onPlay={() => {}}
            />
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
