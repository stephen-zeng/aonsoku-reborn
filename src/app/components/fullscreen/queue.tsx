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
import type { LucideIcon } from "lucide-react";
import { GripVertical, ListX, Repeat } from "lucide-react";
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
import { useQueueDndSensors } from "@/app/components/queue/dnd-sensors";
import { Button } from "@/app/components/ui/button";
import {
  usePlayHistory,
  usePlayHistoryActions,
} from "@/store/playHistory.store";
import {
  usePlayerActions,
  usePlayerCurrentSong,
  usePlayerCurrentSongIndex,
  usePlayerLoop,
  useUserQueue,
  useContextQueue,
  useHasQueueSongs,
} from "@/store/player.store";
import type { ISong } from "@/types/responses/song";
import { LoopState } from "@/types/playerContext";

import { useSongCoverArtUrl } from "@/utils/coverArt";
import { QueueCurrentSong, QueueModeButtons } from "./queue-current-song";
import { QueueSourceLabel } from "@/app/components/queue/queue-source-label";
import RepeatOne from "@/app/components/icons/repeat-one";
import { FULLSCREEN_QUEUE_BG_CLASS } from "./constants";

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

  const distance = Math.abs(
    el.getBoundingClientRect().top - container.getBoundingClientRect().top,
  );
  const resolvedBehavior: ScrollBehavior =
    behavior ??
    (distance > container.clientHeight * 0.5 ? "instant" : "smooth");

  const currentTop =
    el.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop;

  spacer.style.height = "0px";

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
  onCurrentSongClick,
}: {
  hideModeButtons?: boolean;
  onCurrentSongClick?: () => void;
}) {
  const hasSongs = useHasQueueSongs();
  const currentSongIndex = usePlayerCurrentSongIndex();
  const currentSong = usePlayerCurrentSong();
  const { contextSongs, contextIndex } = useContextQueue();
  const { userQueueSongs, clearUserQueue } = useUserQueue();
  const { t } = useTranslation();
  const playHistory = usePlayHistory();
  const filteredHistory = useMemo(() => {
    if (playHistory.length > 0 && currentSong && playHistory[0].id === currentSong.id) {
      return playHistory.slice(1);
    }
    return playHistory;
  }, [playHistory, currentSong]);

  const { clearHistory: clearPlayHistory } = usePlayHistoryActions();

  const upcomingContext = useMemo(
    () => contextSongs.slice(contextIndex + 1),
    [contextSongs, contextIndex],
  );

  if (!hasSongs && filteredHistory.length === 0 && userQueueSongs.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <span className="text-foreground/70">{t("fullscreen.emptyQueue")}</span>
      </div>
    );
  }

  return (
    <UnifiedQueueView
      playHistory={filteredHistory}
      userQueueSongs={userQueueSongs}
      upcomingContext={upcomingContext}
      currentSong={currentSong}
      currentSongIndex={currentSongIndex}
      contextIndex={contextIndex}
      contextSongs={contextSongs}
      hideModeButtons={hideModeButtons}
      clearPlayHistory={clearPlayHistory}
      clearUserQueue={clearUserQueue}
      onCurrentSongClick={onCurrentSongClick}
    />
  );
});

function UnifiedQueueView({
  playHistory,
  userQueueSongs,
  upcomingContext,
  currentSong,
  currentSongIndex,
  contextIndex,
  contextSongs,
  hideModeButtons,
  clearPlayHistory,
  clearUserQueue,
  onCurrentSongClick,
}: {
  playHistory: ISong[];
  userQueueSongs: ISong[];
  upcomingContext: ISong[];
  currentSong: ISong | null;
  currentSongIndex: number;
  contextIndex: number;
  contextSongs: ISong[];
  hideModeButtons: boolean;
  clearPlayHistory: () => void;
  clearUserQueue: () => void;
  onCurrentSongClick?: () => void;
}) {
  const { t } = useTranslation();
  const { playSong, setSongList, reorderQueue } = usePlayerActions();
  const loopState = usePlayerLoop();
  const [activeItem, setActiveItem] = useState<ISong | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentSongRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const [dragOverlayBg, setDragOverlayBg] = useState<string>("");

  const sensors = useQueueDndSensors();
  const queueScrollKey = `${currentSong?.id}:${currentSongIndex}:${contextSongs.length + userQueueSongs.length}:${loopState}`;

  const userSortableItems = useMemo(
    () => userQueueSongs.filter((song) => song.id !== currentSong?.id).map((song) => song.id),
    [userQueueSongs, currentSong],
  );

  const upcomingSortableItems = useMemo(
    () => upcomingContext.map((song) => song.id),
    [upcomingContext],
  );

  useLayoutEffect(() => {
    if (!queueScrollKey) return;
    const el = currentSongRef.current;
    const container = scrollContainerRef.current;
    const spacer = spacerRef.current;
    if (!el || !container || !spacer) return;
    syncQueueCurrentSongPosition({ container, el, spacer });
  }, [queueScrollKey]);

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

  const contextPlayedCount = contextIndex + 1;
  const userQueueStart = contextPlayedCount;

  function handleUserDragStart(event: DragStartEvent) {
    const song = userQueueSongs.find((s) => s.id === event.active.id);
    setActiveItem(song ?? null);
    const el = scrollContainerRef.current?.querySelector<HTMLDivElement>(
      `.${FULLSCREEN_QUEUE_BG_CLASS}`,
    );
    if (el) {
      const beforeBg = getComputedStyle(el, "::before").backgroundColor;
      setDragOverlayBg(beforeBg !== "transparent" ? beforeBg : "");
    }
  }

  function handleUserDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    setDragOverlayBg("");
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromLocal = userQueueSongs.findIndex((s) => s.id === active.id);
    const toLocal = userQueueSongs.findIndex((s) => s.id === over.id);
    if (fromLocal === -1 || toLocal === -1) return;
    const fromGlobal = userQueueStart + fromLocal;
    const toGlobal = userQueueStart + toLocal;
    reorderQueue(fromGlobal, toGlobal);
  }

  function handleUpcomingDragStart(event: DragStartEvent) {
    const song = upcomingContext.find((s) => s.id === event.active.id);
    setActiveItem(song ?? null);
    const el = scrollContainerRef.current?.querySelector<HTMLDivElement>(
      `.${FULLSCREEN_QUEUE_BG_CLASS}`,
    );
    if (el) {
      const beforeBg = getComputedStyle(el, "::before").backgroundColor;
      setDragOverlayBg(beforeBg !== "transparent" ? beforeBg : "");
    }
  }

  function handleUpcomingDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    setDragOverlayBg("");
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromLocal = upcomingContext.findIndex((s) => s.id === active.id);
    const toLocal = upcomingContext.findIndex((s) => s.id === over.id);
    if (fromLocal === -1 || toLocal === -1) return;
    const fromGlobal = contextPlayedCount + userQueueSongs.length + fromLocal;
    const toGlobal = contextPlayedCount + userQueueSongs.length + toLocal;
    reorderQueue(fromGlobal, toGlobal);
  }

  const showContinueHeader =
    loopState !== LoopState.One || userQueueSongs.length > 0;

  const isRepeatOne = loopState === LoopState.One;
  const isRepeatAll = loopState === LoopState.All;

  return (
    <div
      className="flex flex-col h-full overflow-y-auto no-scrollbar"
      data-vaul-no-drag
      ref={scrollContainerRef}
    >
      {playHistory.length > 0 && (
        <div className={FULLSCREEN_QUEUE_BG_CLASS}>
          <div
            className={`${FULLSCREEN_QUEUE_BG_CLASS} sticky top-0 z-10 flex items-center justify-between px-2 py-1`}
          >
            <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
              {t("fullscreen.queueHistory")}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-foreground/50 hover:text-foreground"
              onClick={clearPlayHistory}
            >
              {t("generic.clear")}
            </Button>
          </div>
          {playHistory.map((song, idx) => {
            const displayIdx = playHistory.length - 1 - idx;
            const displaySong = playHistory[displayIdx];
            return (
              <QueueListRow
                key={`${displaySong.id}-${displayIdx}`}
                song={displaySong}
                isActive={false}
                onClick={() => playSong(displaySong)}
              />
            );
          })}
        </div>
      )}

      <div
        ref={currentSongRef}
        className={`shrink-0 px-2 pt-2 pb-1 ${FULLSCREEN_QUEUE_BG_CLASS}`}
      >
        <QueueCurrentSong onClick={onCurrentSongClick} />
      </div>

      <div className={FULLSCREEN_QUEUE_BG_CLASS}>
        <div
          className={`${FULLSCREEN_QUEUE_BG_CLASS} sticky top-0 z-10 px-2 pt-1 pb-1`}
        >
          {!hideModeButtons && <QueueModeButtons />}
          {showContinueHeader && (
            <div
              className={`flex items-center justify-between px-2 ${hideModeButtons ? "pt-1" : "pt-3"}`}
            >
              <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                {t("fullscreen.queueContinue")}
              </h3>
            </div>
          )}
          <QueueSourceLabel />
        </div>

        {isRepeatOne && userQueueSongs.length === 0 && (
          <RepeatIndicator icon={RepeatOne} label={t("fullscreen.queueRepeating")} />
        )}

        {isRepeatOne && userQueueSongs.length > 0 && (
          <>
            <UserQueueDnd
              userQueueSongs={userQueueSongs}
              userSortableItems={userSortableItems}
              currentSong={currentSong}
              sensors={sensors}
              onDragStart={handleUserDragStart}
              onDragEnd={handleUserDragEnd}
              clearUserQueue={clearUserQueue}
              activeItem={activeItem}
              dragOverlayBg={dragOverlayBg}
              t={t}
            />
            <RepeatIndicator icon={RepeatOne} label={t("fullscreen.queueRepeating")} />
          </>
        )}

        {!isRepeatOne && (
          <>
            {userQueueSongs.length > 0 && (
              <UserQueueDnd
                userQueueSongs={userQueueSongs}
                userSortableItems={userSortableItems}
                currentSong={currentSong}
                sensors={sensors}
                onDragStart={handleUserDragStart}
                onDragEnd={handleUserDragEnd}
                clearUserQueue={clearUserQueue}
                activeItem={activeItem}
                dragOverlayBg={dragOverlayBg}
                t={t}
              />
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleUpcomingDragStart}
              onDragEnd={handleUpcomingDragEnd}
            >
              <SortableContext
                items={upcomingSortableItems}
                strategy={verticalListSortingStrategy}
              >
                {upcomingContext.length > 0 && (
                  <div className="px-2 pt-1">
                    <div className="flex items-center px-2 py-1">
                      <h3 className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider">
                        Up Next
                      </h3>
                    </div>
                    {upcomingContext.map((song, idx) => {
                      const globalIndex =
                        contextPlayedCount + userQueueSongs.length + idx;
                      const isActive = currentSong?.id === song.id;
                      return (
                        <SortableUpcomingRow
                          key={song.id}
                          song={song}
                          isActive={isActive}
                          onClick={() => setSongList(contextSongs, globalIndex)}
                          tier="context"
                        />
                      );
                    })}
                  </div>
                )}
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
                        isActive={currentSong?.id === activeItem.id}
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

            {isRepeatAll && (
              <RepeatIndicator icon={Repeat} label={t("fullscreen.queueRepeating")} />
            )}
          </>
        )}
      </div>
      <div ref={spacerRef} className="shrink-0" aria-hidden="true" />
    </div>
  );
}

function RepeatIndicator({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-2 opacity-30 select-none">
      <Icon size={14} />
      <span className="text-xs font-medium uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

function UserQueueDnd({
  userQueueSongs,
  userSortableItems,
  currentSong,
  sensors,
  onDragStart,
  onDragEnd,
  clearUserQueue,
  activeItem,
  dragOverlayBg,
  t,
}: {
  userQueueSongs: ISong[];
  userSortableItems: string[];
  currentSong: ISong | null;
  sensors: ReturnType<typeof useQueueDndSensors>;
  onDragStart: (e: DragStartEvent) => void;
  onDragEnd: (e: DragEndEvent) => void;
  clearUserQueue: () => void;
  activeItem: ISong | null;
  dragOverlayBg: string;
  t: (key: string) => string;
}) {
  const filteredUserQueueSongs = userQueueSongs.filter(
    (song) => song.id !== currentSong?.id,
  );

  if (filteredUserQueueSongs.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={userSortableItems}
        strategy={verticalListSortingStrategy}
      >
        <div className="px-2 pt-1">
          <div className="flex items-center justify-between px-2 py-1">
            <h3 className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider">
              Queue
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[11px] text-foreground/40 hover:text-foreground gap-1"
              onClick={clearUserQueue}
            >
              <ListX className="w-3 h-3" />
              {t("generic.clear")}
            </Button>
          </div>
          {filteredUserQueueSongs.map((song) => {
            const isActive = currentSong?.id === song.id;
            return (
              <SortableUpcomingRow
                key={song.id}
                song={song}
                isActive={isActive}
                onClick={() => {}}
                tier="user"
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
                isActive={currentSong?.id === activeItem.id}
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
  );
}

interface QueueListRowProps {
  song: ISong;
  isActive: boolean;
  onClick: () => void;
  showDragHandle?: boolean;
  interactive?: boolean;
  dragHandleProps?: SyntheticListenerMap;
  tier?: "context" | "user";
}

const QueueListRow = memo(function QueueListRow({
  song,
  isActive,
  onClick,
  showDragHandle = false,
  interactive = true,
  dragHandleProps,
}: QueueListRowProps) {
  const coverArtUrl = useSongCoverArtUrl(song, "100");

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