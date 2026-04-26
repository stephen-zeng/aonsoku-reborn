import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { closestCenter, DndContext, DragOverlay } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { LucideIcon } from "lucide-react";
import { Repeat } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  QueueItemRow,
  SortableQueueItem,
} from "@/app/components/queue/queue-item-row";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { useQueueDndSensors } from "@/app/components/queue/dnd-sensors";
import {
  ScrollArea,
  scrollAreaViewportSelector,
} from "@/app/components/ui/scroll-area";
import { Button } from "@/app/components/ui/button";
import {
  usePlayHistory,
  usePlayHistoryActions,
} from "@/store/playHistory.store";
import {
  usePlayerActions,
  usePlayerCurrentSong,
  usePlayerCurrentSongIndex,
  usePlayerIsPlaying,
  usePlayerLoop,
  useUserQueue,
  useContextQueue,
  useHasQueueSongs,
} from "@/store/player.store";
import type { ISong } from "@/types/responses/song";
import { LoopState } from "@/types/playerContext";

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

interface FullscreenSongQueueProps {
  hideModeButtons?: boolean;
  hideHistory?: boolean;
  hideCurrentSong?: boolean;
  hideRepeatIndicator?: boolean;
  useVirtualization?: boolean;
  scrollAreaClassName?: string;
  thumbClassName?: string;
  onCurrentSongClick?: () => void;
}

export const FullscreenSongQueue = memo(function FullscreenSongQueue({
  hideModeButtons = false,
  hideHistory = false,
  hideCurrentSong = false,
  hideRepeatIndicator = false,
  useVirtualization = false,
  scrollAreaClassName,
  thumbClassName,
  onCurrentSongClick,
}: FullscreenSongQueueProps) {
  const isMobile = useIsMobile();
  const hasSongs = useHasQueueSongs();
  const currentSongIndex = usePlayerCurrentSongIndex();
  const currentSong = usePlayerCurrentSong();
  const { contextSongs, contextIndex } = useContextQueue();
  const { userQueueSongs, clearUserQueue } = useUserQueue();
  const { t } = useTranslation();
  const playHistory = usePlayHistory();
  const filteredHistory = useMemo(() => {
    if (hideHistory) return [];
    if (
      playHistory.length > 0 &&
      currentSong &&
      playHistory[0].id === currentSong.id
    ) {
      return playHistory.slice(1);
    }
    return playHistory;
  }, [playHistory, currentSong, hideHistory]);

  const { clearHistory: clearPlayHistory } = usePlayHistoryActions();

  const upcomingContext = useMemo(
    () => contextSongs.slice(contextIndex + 1),
    [contextSongs, contextIndex],
  );

  if (
    !hasSongs &&
    filteredHistory.length === 0 &&
    userQueueSongs.length === 0
  ) {
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
      hideHistory={hideHistory}
      hideCurrentSong={hideCurrentSong}
      hideRepeatIndicator={hideRepeatIndicator}
      useVirtualization={useVirtualization}
      scrollAreaClassName={scrollAreaClassName}
      thumbClassName={thumbClassName}
      clearPlayHistory={clearPlayHistory}
      clearUserQueue={clearUserQueue}
      onCurrentSongClick={onCurrentSongClick}
      isMobile={isMobile}
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
  hideHistory,
  hideCurrentSong,
  hideRepeatIndicator,
  useVirtualization,
  scrollAreaClassName,
  thumbClassName,
  clearPlayHistory,
  clearUserQueue,
  onCurrentSongClick,
  isMobile,
}: {
  playHistory: ISong[];
  userQueueSongs: ISong[];
  upcomingContext: ISong[];
  currentSong: ISong | null;
  currentSongIndex: number;
  contextIndex: number;
  contextSongs: ISong[];
  hideModeButtons: boolean;
  hideHistory: boolean;
  hideCurrentSong: boolean;
  hideRepeatIndicator: boolean;
  useVirtualization: boolean;
  scrollAreaClassName?: string;
  thumbClassName?: string;
  clearPlayHistory: () => void;
  clearUserQueue: () => void;
  onCurrentSongClick?: () => void;
  isMobile: boolean;
}) {
  const { t } = useTranslation();
  const { playSong, playFromQueue, playFromUserQueue, reorderQueue } =
    usePlayerActions();
  const isPlaying = usePlayerIsPlaying();
  const loopState = usePlayerLoop();
  const [activeItem, setActiveItem] = useState<ISong | null>(null);

  const queueItemProps = {
    hideDownload: true as const,
    hideDuration: isMobile,
    hideDropdownButton: isMobile,
    isMobile,
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentSongRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const [dragOverlayBg, setDragOverlayBg] = useState<string>("");

  const sensors = useQueueDndSensors();
  const queueScrollKey = `${currentSong?.id}:${currentSongIndex}:${contextSongs.length + userQueueSongs.length}:${loopState}`;

  const userSortableItems = useMemo(
    () =>
      userQueueSongs
        .filter((song) => song.id !== currentSong?.id)
        .map((song) => song.id),
    [userQueueSongs, currentSong],
  );

  const upcomingSortableItems = useMemo(
    () => upcomingContext.map((song) => song.id),
    [upcomingContext],
  );

  useLayoutEffect(() => {
    if (useVirtualization) return;
    if (!queueScrollKey) return;
    const el = currentSongRef.current;
    const container = scrollContainerRef.current;
    const spacer = spacerRef.current;
    if (!el || !container || !spacer) return;
    syncQueueCurrentSongPosition({ container, el, spacer });
  }, [queueScrollKey, useVirtualization]);

  useEffect(() => {
    if (useVirtualization) return;
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
  }, [useVirtualization]);

  useEffect(() => {
    if (useVirtualization) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScrollEnd = () => {
      const el = currentSongRef.current;
      const spacer = spacerRef.current;
      if (!el || !container || !spacer) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const partiallyVisible =
        elRect.top < containerRect.bottom &&
        elRect.bottom > containerRect.top;
      const fullyVisible =
        elRect.top >= containerRect.top &&
        elRect.bottom <= containerRect.bottom;
      if (partiallyVisible && !fullyVisible) {
        syncQueueCurrentSongPosition({
          container,
          el,
          spacer,
          behavior: "smooth",
        });
      }
    };
    container.addEventListener("scrollend", handleScrollEnd);
    return () => container.removeEventListener("scrollend", handleScrollEnd);
  }, [useVirtualization]);

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

  if (useVirtualization) {
    return (
      <VirtualizedQueueView
        playHistory={playHistory}
        userQueueSongs={userQueueSongs}
        upcomingContext={upcomingContext}
        currentSong={currentSong}
        contextSongs={contextSongs}
        contextIndex={contextIndex}
        contextPlayedCount={contextPlayedCount}
        hideModeButtons={hideModeButtons}
        hideHistory={hideHistory}
        hideCurrentSong={hideCurrentSong}
        hideRepeatIndicator={hideRepeatIndicator}
        isRepeatOne={isRepeatOne}
        isRepeatAll={isRepeatAll}
        showContinueHeader={showContinueHeader}
        scrollAreaClassName={scrollAreaClassName}
        thumbClassName={thumbClassName}
        sensors={sensors}
        userSortableItems={userSortableItems}
        upcomingSortableItems={upcomingSortableItems}
        activeItem={activeItem}
        dragOverlayBg={dragOverlayBg}
        isPlaying={isPlaying}
        onUserDragStart={handleUserDragStart}
        onUserDragEnd={handleUserDragEnd}
        onUpcomingDragStart={handleUpcomingDragStart}
        onUpcomingDragEnd={handleUpcomingDragEnd}
        playSong={playSong}
        playFromQueue={playFromQueue}
        playFromUserQueue={playFromUserQueue}
        clearPlayHistory={clearPlayHistory}
        clearUserQueue={clearUserQueue}
        onCurrentSongClick={onCurrentSongClick}
        t={t}
        queueItemProps={queueItemProps}
      />
    );
  }

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
            const isCurrent = currentSong?.id === displaySong.id;
            return (
              <QueueItemRow
                key={`${displaySong.id}-${displayIdx}`}
                song={displaySong}
                isPlaying={isCurrent && isPlaying}
                isActive={isCurrent}
                onPlay={() => playSong(displaySong)}
                tier="context"
                {...queueItemProps}
              />
            );
          })}
        </div>
      )}

      {!hideCurrentSong && (
        <div
          ref={currentSongRef}
          className={`shrink-0 px-2 pt-2 pb-1 ${FULLSCREEN_QUEUE_BG_CLASS}`}
        >
          <QueueCurrentSong onClick={onCurrentSongClick} />
        </div>
      )}

      {isRepeatOne && userQueueSongs.length === 0 && (
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
          {!hideRepeatIndicator && (
            <RepeatIndicator
              icon={RepeatOne}
              label={t("fullscreen.queueRepeating")}
            />
          )}
        </div>
      )}

      {isRepeatOne && userQueueSongs.length > 0 && (
        <div className={FULLSCREEN_QUEUE_BG_CLASS}>
          <UserQueueSection
            userQueueSongs={userQueueSongs}
            userSortableItems={userSortableItems}
            currentSong={currentSong}
            sensors={sensors}
            onDragStart={handleUserDragStart}
            onDragEnd={handleUserDragEnd}
            clearUserQueue={clearUserQueue}
            activeItem={activeItem}
            dragOverlayBg={dragOverlayBg}
            isPlaying={isPlaying}
            onPlaySong={(userQueueIndex) => playFromUserQueue(userQueueIndex)}
            t={t}
            sticky
            queueItemProps={queueItemProps}
          />
          <div
            className={`${FULLSCREEN_QUEUE_BG_CLASS} sticky top-0 z-10 px-2 pt-1 pb-1`}
          >
            {!hideModeButtons && <QueueModeButtons />}
            <QueueSourceLabel />
          </div>
          {!hideRepeatIndicator && (
            <RepeatIndicator
              icon={RepeatOne}
              label={t("fullscreen.queueRepeating")}
            />
          )}
        </div>
      )}

      {!isRepeatOne && (
        <>
          {userQueueSongs.length > 0 && (
            <div className={FULLSCREEN_QUEUE_BG_CLASS}>
              <UserQueueSection
                userQueueSongs={userQueueSongs}
                userSortableItems={userSortableItems}
                currentSong={currentSong}
                sensors={sensors}
                onDragStart={handleUserDragStart}
                onDragEnd={handleUserDragEnd}
                clearUserQueue={clearUserQueue}
                activeItem={activeItem}
                dragOverlayBg={dragOverlayBg}
                isPlaying={isPlaying}
                onPlaySong={(userQueueIndex) =>
                  playFromUserQueue(userQueueIndex)
                }
                t={t}
                sticky
                queueItemProps={queueItemProps}
              />
            </div>
          )}

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
                {upcomingContext.length > 0 &&
                  upcomingContext.map((song, idx) => {
                    const contextIdx = contextIndex + 1 + idx;
                    return (
                      <SortableQueueItem
                        key={song.id}
                        id={song.id}
                        song={song}
                        isPlaying={false}
                        isActive={false}
                        onPlay={() => playFromQueue(contextSongs, contextIdx)}
                        tier="context"
                        {...queueItemProps}
                      />
                    );
                  })}
              </SortableContext>
              {createPortal(
                <DragOverlay>
                  {activeItem && (
                    <div
                      className="rounded-md shadow-lg"
                      style={{ background: dragOverlayBg || undefined }}
                    >
                      <QueueItemRow
                        song={activeItem}
                        isPlaying={
                          currentSong?.id === activeItem.id && isPlaying
                        }
                        isActive={currentSong?.id === activeItem.id}
                        onPlay={() => {}}
                        {...queueItemProps}
                      />
                    </div>
                  )}
                </DragOverlay>,
                document.body,
              )}
            </DndContext>

            {isRepeatAll && !hideRepeatIndicator && (
              <RepeatIndicator
                icon={Repeat}
                label={t("fullscreen.queueRepeating")}
              />
            )}
          </div>
        </>
      )}
      <div ref={spacerRef} className="shrink-0" aria-hidden="true" />
    </div>
  );
}

function VirtualizedQueueView({
  playHistory,
  userQueueSongs,
  upcomingContext,
  currentSong,
  contextSongs,
  contextIndex,
  contextPlayedCount,
  hideModeButtons,
  hideHistory,
  hideCurrentSong,
  hideRepeatIndicator,
  isRepeatOne,
  isRepeatAll,
  showContinueHeader,
  scrollAreaClassName,
  thumbClassName,
  sensors,
  userSortableItems,
  upcomingSortableItems,
  activeItem,
  dragOverlayBg,
  isPlaying,
  onUserDragStart,
  onUserDragEnd,
  onUpcomingDragStart,
  onUpcomingDragEnd,
  playSong,
  playFromQueue,
  playFromUserQueue,
  clearPlayHistory,
  clearUserQueue,
  onCurrentSongClick,
  t,
  queueItemProps,
}: {
  playHistory: ISong[];
  userQueueSongs: ISong[];
  upcomingContext: ISong[];
  currentSong: ISong | null;
  contextSongs: ISong[];
  contextIndex: number;
  contextPlayedCount: number;
  hideModeButtons: boolean;
  hideHistory: boolean;
  hideCurrentSong: boolean;
  hideRepeatIndicator: boolean;
  isRepeatOne: boolean;
  isRepeatAll: boolean;
  showContinueHeader: boolean;
  scrollAreaClassName?: string;
  thumbClassName?: string;
  sensors: ReturnType<typeof useQueueDndSensors>;
  userSortableItems: string[];
  upcomingSortableItems: string[];
  activeItem: ISong | null;
  dragOverlayBg: string;
  isPlaying: boolean;
  onUserDragStart: (e: DragStartEvent) => void;
  onUserDragEnd: (e: DragEndEvent) => void;
  onUpcomingDragStart: (e: DragStartEvent) => void;
  onUpcomingDragEnd: (e: DragEndEvent) => void;
  playSong: (song: ISong) => void;
  playFromQueue: (songs: ISong[], index: number) => void;
  playFromUserQueue: (index: number) => void;
  clearPlayHistory: () => void;
  clearUserQueue: () => void;
  onCurrentSongClick?: () => void;
  t: (key: string) => string;
  queueItemProps: {
    hideDownload: boolean;
    hideDuration: boolean;
    hideDropdownButton: boolean;
    isMobile: boolean;
  };
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const prevSongIdRef = useRef<string | null>(null);

  const getScrollElement = useCallback(() => {
    if (!parentRef.current) return null;
    return parentRef.current.querySelector(scrollAreaViewportSelector);
  }, []);

  type VirtualItem =
    | { type: "history"; song: ISong; key: string }
    | { type: "currentSong" }
    | { type: "queueHeader" }
    | { type: "userQueueSong"; song: ISong; userQueueIndex: number }
    | { type: "queueDivider" }
    | { type: "continueHeader" }
    | { type: "upcomingSong"; song: ISong; contextIdx: number }
    | { type: "repeatIndicator"; icon: LucideIcon; label: string };

  const virtualItems = useMemo(() => {
    const items: VirtualItem[] = [];

    if (!hideHistory) {
      for (let i = playHistory.length - 1; i >= 0; i--) {
        items.push({
          type: "history",
          song: playHistory[i],
          key: `history-${playHistory[i].id}-${i}`,
        });
      }
    }

    if (!hideCurrentSong) {
      items.push({ type: "currentSong" });
    }

    const filteredUserQueueSongs = userQueueSongs.filter(
      (song) => song.id !== currentSong?.id,
    );

    if (filteredUserQueueSongs.length > 0) {
      items.push({ type: "queueHeader" });
      for (const song of filteredUserQueueSongs) {
        const userQueueIndex = userQueueSongs.findIndex(
          (s) => s.id === song.id,
        );
        items.push({
          type: "userQueueSong",
          song,
          userQueueIndex,
        });
      }
    }

    if (filteredUserQueueSongs.length > 0 && upcomingContext.length > 0) {
      items.push({ type: "queueDivider" });
    }

    if (showContinueHeader) {
      items.push({ type: "continueHeader" });
    }

    for (let idx = 0; idx < upcomingContext.length; idx++) {
      const song = upcomingContext[idx];
      const contextIdx = contextIndex + 1 + idx;
      items.push({ type: "upcomingSong", song, contextIdx });
    }

    if (!hideRepeatIndicator) {
      if (isRepeatOne) {
        items.push({
          type: "repeatIndicator",
          icon: RepeatOne,
          label: t("fullscreen.queueRepeating"),
        });
      } else if (isRepeatAll) {
        items.push({
          type: "repeatIndicator",
          icon: Repeat,
          label: t("fullscreen.queueRepeating"),
        });
      }
    }

    return items;
  }, [
    hideHistory,
    hideCurrentSong,
    hideRepeatIndicator,
    playHistory,
    userQueueSongs,
    upcomingContext,
    currentSong,
    contextIndex,
    showContinueHeader,
    isRepeatOne,
    isRepeatAll,
    t,
  ]);

  const virtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement,
    estimateSize: (index) => {
      const item = virtualItems[index];
      if (!item) return 64;
      switch (item.type) {
        case "history":
        case "userQueueSong":
        case "upcomingSong":
          return 64;
        case "currentSong":
          return 56;
        case "queueHeader":
          return 36;
        case "queueDivider":
          return 20;
        case "continueHeader":
          return 52;
        case "repeatIndicator":
          return 36;
        default:
          return 64;
      }
    },
    overscan: 5,
  });

  const currentSongVirtualIndex = useMemo(() => {
    const idx = virtualItems.findIndex((item) => item.type === "currentSong");
    return idx >= 0 ? idx : -1;
  }, [virtualItems]);

  useEffect(() => {
    if (currentSong?.id && currentSong?.id !== prevSongIdRef.current) {
      prevSongIdRef.current = currentSong.id;
      if (currentSongVirtualIndex >= 0) {
        virtualizer.scrollToIndex(currentSongVirtualIndex, { align: "center" });
      }
    }
  }, [currentSong?.id, currentSongVirtualIndex, virtualizer]);

  useEffect(() => {
    const scrollEl = getScrollElement();
    if (!scrollEl) return;
    const handleScrollEnd = () => {
      const currentSongEl = scrollEl.querySelector<HTMLElement>(
        "[data-current-song]",
      );
      if (!currentSongEl) return;
      const containerRect = scrollEl.getBoundingClientRect();
      const elRect = currentSongEl.getBoundingClientRect();
      const partiallyVisible =
        elRect.top < containerRect.bottom &&
        elRect.bottom > containerRect.top;
      const fullyVisible =
        elRect.top >= containerRect.top &&
        elRect.bottom <= containerRect.bottom;
      if (partiallyVisible && !fullyVisible && currentSongVirtualIndex >= 0) {
        virtualizer.scrollToIndex(currentSongVirtualIndex, {
          align: "start",
          behavior: "smooth",
        });
      }
    };
    scrollEl.addEventListener("scrollend", handleScrollEnd);
    return () => scrollEl.removeEventListener("scrollend", handleScrollEnd);
  }, [currentSongVirtualIndex, virtualizer, getScrollElement]);

  if (virtualItems.length === 0) {
    return (
      <div className="flex flex-1 flex-col h-full min-w-0 items-center justify-center">
        <span className="text-foreground/70">{t("fullscreen.emptyQueue")}</span>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onUserDragStart}
        onDragEnd={onUserDragEnd}
      >
        <SortableContext
          items={userSortableItems}
          strategy={verticalListSortingStrategy}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onUpcomingDragStart}
            onDragEnd={onUpcomingDragEnd}
          >
            <SortableContext
              items={upcomingSortableItems}
              strategy={verticalListSortingStrategy}
            >
              <ScrollArea
                ref={parentRef}
                type="always"
                className={scrollAreaClassName ?? "w-full h-full overflow-auto"}
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
                    const item = virtualItems[virtualRow.index];
                    if (!item) return null;

                    return (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        {item.type === "history" && (
                          <QueueItemRow
                            song={item.song}
                            isPlaying={
                              currentSong?.id === item.song.id && isPlaying
                            }
                            isActive={currentSong?.id === item.song.id}
                            onPlay={() => playSong(item.song)}
                            tier="context"
                            {...queueItemProps}
                          />
                        )}

                        {item.type === "currentSong" && (
                          <div
                            data-current-song
                            className="px-0 pt-2 pb-0.5"
                          >
                            <QueueCurrentSong onClick={onCurrentSongClick} />
                          </div>
                        )}

                        {item.type === "queueHeader" && (
                          <div className="flex items-center justify-between px-1 py-1">
                            <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                              Queue
                            </h3>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-foreground/50 hover:text-foreground"
                              onClick={clearUserQueue}
                            >
                              {t("generic.clear")}
                            </Button>
                          </div>
                        )}

                        {item.type === "userQueueSong" && (
                          <SortableQueueItem
                            id={item.song.id}
                            song={item.song}
                            isPlaying={
                              currentSong?.id === item.song.id && isPlaying
                            }
                            isActive={currentSong?.id === item.song.id}
                            onPlay={() =>
                              playFromUserQueue(item.userQueueIndex)
                            }
                            tier="user"
                            {...queueItemProps}
                          />
                        )}

                        {item.type === "queueDivider" && (
                          <div className="flex items-center gap-2 px-1 py-0.5 mb-0.5">
                            <div className="h-px flex-1 bg-foreground/10" />
                            <span className="text-[10px] font-medium text-foreground/40 uppercase tracking-wider whitespace-nowrap">
                              {t("fullscreen.queueContinue")}
                            </span>
                            <div className="h-px flex-1 bg-foreground/10" />
                          </div>
                        )}

                        {item.type === "continueHeader" && (
                          <div>
                            {!hideModeButtons && <QueueModeButtons />}
                            <div
                              className={`flex items-center justify-between px-2 ${hideModeButtons ? "pt-1" : "pt-3"}`}
                            >
                              <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                                {t("fullscreen.queueContinue")}
                              </h3>
                            </div>
                            <QueueSourceLabel />
                          </div>
                        )}

                        {item.type === "upcomingSong" && (
                          <SortableQueueItem
                            id={item.song.id}
                            song={item.song}
                            isPlaying={false}
                            isActive={false}
                            onPlay={() =>
                              playFromQueue(contextSongs, item.contextIdx)
                            }
                            tier="context"
                            {...queueItemProps}
                          />
                        )}

                        {item.type === "repeatIndicator" && (
                          <RepeatIndicator
                            icon={item.icon}
                            label={item.label}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </SortableContext>
          </DndContext>
        </SortableContext>
      </DndContext>
      {createPortal(
        <DragOverlay>
          {activeItem && (
            <div
              className="rounded-md shadow-lg"
              style={{ background: dragOverlayBg || undefined }}
            >
              <QueueItemRow
                song={activeItem}
                isPlaying={currentSong?.id === activeItem.id && isPlaying}
                isActive={currentSong?.id === activeItem.id}
                onPlay={() => {}}
                {...queueItemProps}
              />
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}
    </>
  );
}

function RepeatIndicator({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-2 opacity-30 select-none">
      <Icon size={14} />
      <span className="text-xs font-medium uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

function UserQueueSection({
  userQueueSongs,
  userSortableItems,
  currentSong,
  sensors,
  onDragStart,
  onDragEnd,
  clearUserQueue,
  activeItem,
  dragOverlayBg,
  isPlaying,
  onPlaySong,
  t,
  sticky = false,
  queueItemProps,
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
  isPlaying: boolean;
  onPlaySong: (userQueueIndex: number) => void;
  t: (key: string) => string;
  sticky?: boolean;
  queueItemProps: {
    hideDownload: boolean;
    hideDuration: boolean;
    hideDropdownButton: boolean;
    isMobile: boolean;
  };
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
          <div
            className={`${sticky ? `${FULLSCREEN_QUEUE_BG_CLASS} sticky top-0 z-10 ` : ""}flex items-center justify-between px-2 py-1`}
          >
            <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
              Queue
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-foreground/50 hover:text-foreground"
              onClick={clearUserQueue}
            >
              {t("generic.clear")}
            </Button>
          </div>
          {filteredUserQueueSongs.map((song) => {
            const userQueueIndex = userQueueSongs.findIndex(
              (s) => s.id === song.id,
            );
            const isCurrent = currentSong?.id === song.id;
            return (
              <SortableQueueItem
                key={song.id}
                id={song.id}
                song={song}
                isPlaying={isCurrent && isPlaying}
                isActive={isCurrent}
                onPlay={() => onPlaySong(userQueueIndex)}
                tier="user"
                {...queueItemProps}
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
              <QueueItemRow
                song={activeItem}
                isPlaying={currentSong?.id === activeItem.id && isPlaying}
                isActive={currentSong?.id === activeItem.id}
                onPlay={() => {}}
                {...queueItemProps}
              />
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
