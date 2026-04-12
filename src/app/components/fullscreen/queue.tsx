import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LoopState } from "@/types/playerContext";
import {
  usePlayerActions,
  usePlayerCurrentList,
  usePlayerCurrentSong,
  usePlayerCurrentSongIndex,
  usePlayerIsPlaying,
  usePlayerLoop,
  usePlayerShuffle,
} from "@/store/player.store";
import type { ISong } from "@/types/responses/song";
import { QueueSection } from "./queue-section";

export const FullscreenSongQueue = memo(function FullscreenSongQueue() {
  const currentList = usePlayerCurrentList();
  const currentSongIndex = usePlayerCurrentSongIndex();
  const currentSong = usePlayerCurrentSong();
  const isPlaying = usePlayerIsPlaying();

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
    <QueueModeControls
      history={history}
      upcoming={upcoming}
      currentSong={currentSong}
      currentSongIndex={currentSongIndex}
      currentList={currentList}
      isPlaying={isPlaying}
    />
  );
});

function QueueModeControls({
  history,
  upcoming,
  currentSong,
  currentSongIndex,
  currentList,
  isPlaying,
}: {
  history: ISong[];
  upcoming: ISong[];
  currentSong: ISong;
  currentSongIndex: number;
  currentList: ISong[];
  isPlaying: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full gap-2">
      {history.length > 0 && (
        <QueueSection
          title={t("fullscreen.queueHistory")}
          songs={history}
          currentSong={currentSong}
          isPlaying={isPlaying}
          startIndex={0}
          fullList={currentList}
        />
      )}

      <div className="flex items-center justify-center gap-2 py-1 shrink-0">
        <ShuffleToggle />
        <RepeatToggle />
      </div>

      {upcoming.length > 0 && (
        <QueueSection
          title={t("fullscreen.queueContinue")}
          songs={upcoming}
          currentSong={currentSong}
          isPlaying={isPlaying}
          startIndex={currentSongIndex + 1}
          fullList={currentList}
        />
      )}
    </div>
  );
}

function ShuffleToggle() {
  const isShuffleActive = usePlayerShuffle();
  const { toggleShuffle } = usePlayerActions();
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={toggleShuffle}
      title={
        isShuffleActive
          ? t("player.tooltips.shuffle.disable")
          : t("player.tooltips.shuffle.enable")
      }
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        isShuffleActive
          ? "bg-foreground/15 text-foreground"
          : "text-foreground/60 border border-foreground/30 hover:text-foreground hover:bg-foreground/10"
      }`}
    >
      {isShuffleActive
        ? t("player.tooltips.shuffle.disable")
        : t("player.tooltips.shuffle.enable")}
    </button>
  );
}

function RepeatToggle() {
  const loopState = usePlayerLoop();
  const { toggleLoop } = usePlayerActions();
  const { t } = useTranslation();

  const isActive = loopState !== LoopState.Off;

  const label =
    loopState === LoopState.One
      ? t("player.tooltips.repeat.enableOne")
      : t("player.tooltips.repeat.enable");

  return (
    <button
      type="button"
      onClick={toggleLoop}
      title={isActive ? t("player.tooltips.repeat.disable") : label}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        isActive
          ? "bg-foreground/15 text-foreground"
          : "text-foreground/60 border border-foreground/30 hover:text-foreground hover:bg-foreground/10"
      }`}
    >
      {isActive ? t("player.tooltips.repeat.disable") : label}
    </button>
  );
}
