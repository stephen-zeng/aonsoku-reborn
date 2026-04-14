import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core";
import { closestCenter, DndContext, DragOverlay } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useQueueDndSensors } from "@/app/components/queue/dnd-sensors";
import { useTranslation } from "react-i18next";
import { getCoverArtUrl } from "@/api/httpClient";
import { Button } from "@/app/components/ui/button";
import {
  usePlayerActions,
  usePlayerCurrentList,
  usePlayerCurrentSong,
  usePlayerCurrentSongIndex,
  useQueueSource,
} from "@/store/player.store";
import type { ISong } from "@/types/responses/song";
import { QueueCurrentSong, QueueModeButtons } from "./queue-current-song";

function syncQueueCurrentSongPosition({
  container,
  el,
  behavior,
}: {
  container: HTMLDivElement;
  el: HTMLDivElement;
  behavior?: ScrollBehavior;
}) {
  if (container.clientHeight === 0) return;

  container.style.setProperty("--queue-scroll-pad", "0px");

  const currentTop =
    el.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop;
  const remainingHeight = container.scrollHeight - currentTop;
  const scrollPad = Math.max(0, container.clientHeight - remainingHeight);

  container.style.setProperty("--queue-scroll-pad", `${scrollPad}px`);

  const distance = Math.abs(
    el.getBoundingClientRect().top - container.getBoundingClientRect().top,
  );
  const resolvedBehavior: ScrollBehavior =
    behavior ??
    (distance > container.clientHeight * 0.5 ? "instant" : "smooth");

  el.scrollIntoView({ block: "start", behavior: resolvedBehavior });
}

export const FullscreenSongQueue = memo(function FullscreenSongQueue() {
  const currentList = usePlayerCurrentList();
  const currentSongIndex = usePlayerCurrentSongIndex();
  const currentSong = usePlayerCurrentSong();

  const history = useMemo(
    () => currentList.slice(0, currentSongIndex),
    [currentList, currentSongIndex],
  );
  const upcoming = useMemo(
    () => currentList.slice(currentSongIndex + 1),
    [currentList, currentSongIndex],
  );

  if (currentList.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <span className="text-foreground/70">No songs in queue</span>
      </div>
    );
  }

  return (
    <UnifiedQueueView
      history={history}
      upcoming={upcoming}
      currentSong={currentSong}
      currentSongIndex={currentSongIndex}
      currentList={currentList}
    />
  );
});

function UnifiedQueueView({
  history,
  upcoming,
  currentSong,
  currentSongIndex,
  currentList,
}: {
  history: ISong[];
  upcoming: ISong[];
  currentSong: ISong;
  currentSongIndex: number;
  currentList: ISong[];
}) {
  const { t } = useTranslation();
  const { setSongList, clearHistory, reorderQueue } = usePlayerActions();
  const queueSource = useQueueSource();
  const [activeItem, setActiveItem] = useState<ISong | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentSongRef = useRef<HTMLDivElement>(null);

  const sensors = useQueueDndSensors();
  const queueScrollKey = `${currentSong.id}:${currentSongIndex}:${currentList.length}`;

  useLayoutEffect(() => {
    if (!queueScrollKey) return;

    const el = currentSongRef.current;
    const container = scrollContainerRef.current;
    if (!el || !container) return;

    syncQueueCurrentSongPosition({ container, el });
  }, [queueScrollKey]);

  useEffect(() => {
    const el = currentSongRef.current;
    const container = scrollContainerRef.current;
    if (!el || !container) return;

    let rafId = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        syncQueueCurrentSongPosition({
          container,
          el,
          behavior: "instant",
        });
      });
    });
    observer.observe(container);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  const sortableItems = useMemo(
    () => upcoming.map((song) => song.id),
    [upcoming],
  );

  function handleDragStart(event: DragStartEvent) {
    const song = upcoming.find((s) => s.id === event.active.id);
    setActiveItem(song ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromLocalIndex = upcoming.findIndex((s) => s.id === active.id);
    const toLocalIndex = upcoming.findIndex((s) => s.id === over.id);
    if (fromLocalIndex === -1 || toLocalIndex === -1) return;

    const fromGlobalIndex = currentSongIndex + 1 + fromLocalIndex;
    const toGlobalIndex = currentSongIndex + 1 + toLocalIndex;

    reorderQueue(fromGlobalIndex, toGlobalIndex);
  }

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ paddingBottom: "var(--queue-scroll-pad, 0px)" }}
      data-vaul-no-drag
      ref={scrollContainerRef}
    >
      {history.length > 0 && (
        <div className="shrink-0">
          <div className="flex items-center justify-between px-2 py-1">
            <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
              {t("fullscreen.queueHistory")}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-foreground/50 hover:text-foreground"
              onClick={clearHistory}
            >
              {t("generic.clear")}
            </Button>
          </div>
          {history.map((song, idx) => {
            const globalIndex = idx;
            const isActive = currentSong.id === song.id;
            return (
              <QueueListRow
                key={song.id}
                song={song}
                isActive={isActive}
                onClick={() => setSongList(currentList, globalIndex)}
              />
            );
          })}
        </div>
      )}

      <div
        ref={currentSongRef}
        className="shrink-0 px-2 py-2 border-t border-foreground/10"
      >
        <QueueCurrentSong />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortableItems}
          strategy={verticalListSortingStrategy}
        >
          <div className="sticky top-0 z-10 px-2 pt-1 pb-1 bg-background/80 backdrop-blur-sm border-b border-foreground/10">
            <QueueModeButtons />
            <div className="flex items-center justify-between px-2 pt-1">
              <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                {t("fullscreen.queueContinue")}
              </h3>
            </div>
            {queueSource && (
              <p className="text-xs text-foreground/50 px-2 pb-1 truncate">
                {t("fullscreen.queueFromSource", { source: queueSource })}
              </p>
            )}
          </div>
          {upcoming.map((song, idx) => {
            const globalIndex = currentSongIndex + 1 + idx;
            const isActive = currentSong.id === song.id;
            return (
              <SortableUpcomingRow
                key={song.id}
                song={song}
                isActive={isActive}
                onClick={() => setSongList(currentList, globalIndex)}
              />
            );
          })}
        </SortableContext>
        {createPortal(
          <DragOverlay>
            {activeItem && (
              <QueueListRow
                song={activeItem}
                isActive={currentSong.id === activeItem.id}
                onClick={() => {}}
                interactive={false}
                showDragHandle={false}
              />
            )}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </div>
  );
}

interface QueueListRowProps {
  song: ISong;
  isActive: boolean;
  onClick: () => void;
  showDragHandle?: boolean;
  interactive?: boolean;
  dragHandleProps?: SyntheticListenerMap;
}

const QueueListRow = memo(function QueueListRow({
  song,
  isActive,
  onClick,
  showDragHandle = false,
  interactive = true,
  dragHandleProps,
}: QueueListRowProps) {
  const coverArtUrl = getCoverArtUrl(song.coverArt, "song", "100");

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
        isActive ? "bg-accent" : ""
      }`}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <div className="w-9 h-9 rounded shrink-0 overflow-hidden bg-accent">
        <img
          src={coverArtUrl}
          className="w-9 h-9 object-cover"
          alt={`${song.title} - ${song.artist}`}
          loading="lazy"
        />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span
          className={`text-sm font-medium truncate ${
            isActive ? "text-primary" : ""
          }`}
        >
          {song.title}
        </span>
        <span className="text-xs text-foreground/70 truncate">
          {song.artist}
        </span>
      </div>
      {showDragHandle && (
        <span
          className="text-foreground/30 shrink-0 cursor-grab select-none px-1"
          onClick={(e) => e.stopPropagation()}
          {...dragHandleProps}
        >
          <GripVertical className="w-4 h-4" />
        </span>
      )}
    </div>
  );
});

const SortableUpcomingRow = memo(function SortableUpcomingRow(
  props: QueueListRowProps,
) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.song.id });

  const { role: _, tabIndex: __, ...restAttributes } = attributes;

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...restAttributes}>
      <QueueListRow
        {...props}
        interactive
        showDragHandle
        dragHandleProps={listeners}
      />
    </div>
  );
});
