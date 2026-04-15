import type {
  DragEndEvent,
  DragStartEvent,
  SyntheticListenerMap,
} from "@dnd-kit/core";
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
import { useTranslation } from "react-i18next";
import { getCoverArtUrl } from "@/api/httpClient";
import { useQueueDndSensors } from "@/app/components/queue/dnd-sensors";
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
import { FULLSCREEN_QUEUE_BG_CLASS } from "./constants";

/**
 * Scrolls the queue so that the current song element sits at the very top
 * of the visible area.  When the remaining content below the current song
 * is shorter than the container, a spacer div is inflated so the container
 * can still scroll far enough — this prevents the current song from being
 * stuck mid-view when near the end of the queue.
 *
 * CAVEATS for future maintainers:
 *  1. `distance` and `resolvedBehavior` are computed *before* any DOM writes
 *     because `getBoundingClientRect` values shift once we mutate the spacer.
 *  2. `spacer.style.height` is reset to "0px" first so that `offsetHeight`
 *     reads inside the loop reflect real content only (the spacer itself
 *     contributes 0).  If you remove this reset the spacer will inflate
 *     `contentBelowTop` and the calculation will be wrong.
 *  3. The loop skips children with `offsetParent === null` (display:none,
 *     e.g. DndKit's HiddenText) and `position:fixed` (e.g. DndKit's
 *     LiveRegion) because they don't contribute to in-flow scroll height.
 *  4. After setting the spacer to its final height we do NOT read layout
 *     again — `scrollTop` / `scrollTo` with the pre-calculated `currentTop`
 *     is sufficient because the spacer only extends content *below* the
 *     current song and cannot affect its offset from the container top.
 */
function syncQueueCurrentSongPosition({
  container,
  el,
  spacer,
  behavior,
}: {
  container: HTMLDivElement;
  el: HTMLDivElement;
  spacer: HTMLDivElement;
  behavior?: ScrollBehavior;
}) {
  if (container.clientHeight === 0) return;

  // Determine scroll behavior BEFORE any DOM mutations, using current positions.
  const distance = Math.abs(
    el.getBoundingClientRect().top - container.getBoundingClientRect().top,
  );
  const resolvedBehavior: ScrollBehavior =
    behavior ??
    (distance > container.clientHeight * 0.5 ? "instant" : "smooth");

  // Compute el's offset from the scroll container's content top.
  const currentTop =
    el.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop;

  // Reset spacer so it doesn't inflate measurements.
  spacer.style.height = "0px";

  // To compute how much content sits below the top edge of el,
  // we sum the offsetHeight of every direct container child from el onward,
  // skipping fixed-position and hidden elements (e.g. DndKit accessibility nodes).
  let contentBelowTop = 0;
  let foundCurrent = false;
  for (const child of container.children) {
    if (child === el) foundCurrent = true;
    if (foundCurrent) {
      const styled = child as HTMLElement;
      if (styled.offsetParent === null) continue;
      const computed = getComputedStyle(styled);
      if (computed.position === "fixed") continue;
      contentBelowTop += styled.offsetHeight;
    }
  }

  const scrollPad = Math.max(0, container.clientHeight - contentBelowTop);
  spacer.style.height = `${scrollPad}px`;

  if (resolvedBehavior === "instant") {
    container.scrollTop = currentTop;
  } else {
    container.scrollTo({ top: currentTop, behavior: "smooth" });
  }
}

export const FullscreenSongQueue = memo(function FullscreenSongQueue({
  hideModeButtons = false,
}: {
  hideModeButtons?: boolean;
}) {
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
      hideModeButtons={hideModeButtons}
    />
  );
});

function UnifiedQueueView({
  history,
  upcoming,
  currentSong,
  currentSongIndex,
  currentList,
  hideModeButtons,
}: {
  history: ISong[];
  upcoming: ISong[];
  currentSong: ISong;
  currentSongIndex: number;
  currentList: ISong[];
  hideModeButtons: boolean;
}) {
  const { t } = useTranslation();
  const { setSongList, clearHistory, reorderQueue } = usePlayerActions();
  const queueSource = useQueueSource();
  const [activeItem, setActiveItem] = useState<ISong | null>(null);

  // Refs must be read inside the rAF callback, not captured at mount time,
  // because React may replace the underlying DOM element between renders.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentSongRef = useRef<HTMLDivElement>(null);
  // Spacer div sits at the very bottom of the scroll container and is
  // dynamically sized by syncQueueCurrentSongPosition so that the scroll
  // container can always scroll the current song to the very top, even when
  // there aren't enough upcoming tracks to fill the viewport.
  // DO NOT remove `shrink-0` — without it the flex container would compress
  // the spacer to 0 instead of honouring its inline height.
  const spacerRef = useRef<HTMLDivElement>(null);
  const [dragOverlayBg, setDragOverlayBg] = useState<string>("");

  const sensors = useQueueDndSensors();
  const queueScrollKey = `${currentSong.id}:${currentSongIndex}:${currentList.length}`;

  // Scroll the current song into view whenever the queue content changes
  // (song change, index change, or list length change).  useLayoutEffect
  // fires synchronously after DOM mutations so the user never sees the
  // old scroll position.
  useLayoutEffect(() => {
    if (!queueScrollKey) return;

    const el = currentSongRef.current;
    const container = scrollContainerRef.current;
    const spacer = spacerRef.current;
    if (!el || !container || !spacer) return;

    syncQueueCurrentSongPosition({ container, el, spacer });
  }, [queueScrollKey]);

  // Re-scroll when the container resizes (e.g. panel open/close, orientation
  // change).  Reads refs inside the rAF callback to avoid stale closures.
  useEffect(() => {
    let rafId = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const el = currentSongRef.current;
        const container = scrollContainerRef.current;
        const spacer = spacerRef.current;
        if (!el || !container || !spacer) return;
        syncQueueCurrentSongPosition({
          container,
          el,
          spacer,
          behavior: "instant",
        });
      });
    });
    const container = scrollContainerRef.current;
    if (!container) return;
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

    const el = scrollContainerRef.current?.querySelector<HTMLDivElement>(
      `.${FULLSCREEN_QUEUE_BG_CLASS}`,
    );
    if (el) {
      setDragOverlayBg(getComputedStyle(el).background);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    setDragOverlayBg("");
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
      className="flex flex-col h-full overflow-y-auto no-scrollbar"
      data-vaul-no-drag
      ref={scrollContainerRef}
    >
      {history.length > 0 && (
        <div className={`shrink-0 ${FULLSCREEN_QUEUE_BG_CLASS}`}>
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
        className={`shrink-0 px-2 pt-2 pb-1 ${FULLSCREEN_QUEUE_BG_CLASS}`}
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
          {/* Wrapper provides the composite background so the sticky header
              blends seamlessly with the content below it. Without this, a
              white/uncolored strip appears at the header edges on scroll. */}
          <div className={FULLSCREEN_QUEUE_BG_CLASS}>
            <div className="sticky top-0 z-10 px-2 pt-1 pb-1">
              {!hideModeButtons && <QueueModeButtons />}
              <div
                className={`flex items-center justify-between px-2 ${hideModeButtons ? "pt-1" : "pt-3"}`}
              >
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
          </div>
        </SortableContext>
        {createPortal(
          <DragOverlay>
            {activeItem && (
              <div
                className="rounded-md shadow-lg"
                style={{ background: dragOverlayBg || undefined }}
              >
                <QueueListRow
                  song={activeItem}
                  isActive={currentSong.id === activeItem.id}
                  onClick={() => {}}
                  interactive={false}
                  showDragHandle={false}
                />
              </div>
            )}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
      <div ref={spacerRef} className="shrink-0" aria-hidden="true" />
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
          className="text-foreground/30 shrink-0 cursor-grab select-none px-1 py-2 -my-2 touch-none"
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
