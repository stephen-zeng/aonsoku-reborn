import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ListMusic, Music } from "lucide-react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { useHasLyrics } from "@/app/hooks/use-has-lyrics";
import { useFullscreenPlayerState, usePlayerStore } from "@/store/player.store";
import { FullscreenControls } from "./controls";
import { LikeButton } from "./like-button";
import { LyricsTab } from "./lyrics";
import { MobileVolumeBar } from "./mobile-volume-bar";
import { FullscreenProgress } from "./progress";
import { FullscreenSettings } from "./settings";
import { FullscreenSongQueue } from "./queue";
import { FullscreenSongArtwork } from "./song-artwork";
import { CompactSongInfo, SongInfo } from "./song-info";

const MemoSongQueue = memo(FullscreenSongQueue);
const MemoLyricsTab = memo(LyricsTab);
const MemoSongInfo = memo(SongInfo);

type MobileView = "playing" | "lyrics" | "queue";

function MobileMiniSongInfo() {
  const currentSong = usePlayerStore((state) => state.songlist.currentSong);

  return (
    <div className="flex items-center gap-2 min-h-0 truncate">
      <p className="text-sm font-medium truncate">{currentSong.title}</p>
      <span className="text-sm text-foreground/70">·</span>
      <p className="text-sm text-foreground/70 truncate">
        {currentSong.artist}
      </p>
    </div>
  );
}

function MobileTabButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`gap-1.5 ${
        disabled
          ? "opacity-50 cursor-not-allowed text-foreground/70"
          : active
            ? "text-foreground hover:text-foreground"
            : "text-foreground/70 hover:text-foreground hover:bg-foreground/10"
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Button>
  );
}

function MobileSongInfoRow() {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <MemoSongInfo />
      </div>
      <div className="flex items-center gap-1 shrink-0 pt-1">
        <LikeButton />
        <FullscreenSettings />
      </div>
    </div>
  );
}

function MobileBottomTabs({
  view,
  setView,
  lyricsDisabled,
}: {
  view: MobileView;
  setView: (view: MobileView) => void;
  lyricsDisabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="shrink-0 flex items-center justify-center gap-6 pt-1 pb-2">
      <MobileTabButton
        icon={<Music className="size-4" />}
        label={t("fullscreen.lyrics")}
        active={view === "lyrics"}
        disabled={lyricsDisabled}
        onClick={() =>
          !lyricsDisabled && setView(view === "lyrics" ? "playing" : "lyrics")
        }
      />
      <FullscreenSettings />
      <MobileTabButton
        icon={<ListMusic className="size-4" />}
        label={t("fullscreen.queue")}
        active={view === "queue"}
        disabled={false}
        onClick={() => setView(view === "queue" ? "playing" : "queue")}
      />
    </div>
  );
}

export const MobileLayout = memo(function MobileLayout() {
  const [view, setView] = useState<MobileView>("playing");
  const { closeFullscreenPlayer } = useFullscreenPlayerState();
  const { hasLyrics } = useHasLyrics();

  const lyricsDisabled = hasLyrics === false;

  return (
    <div className="flex flex-col h-full w-full">
      <AnimatePresence mode="wait">
        {view === "playing" && (
          <motion.div
            key="playing-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center px-2 pt-1 pb-1 shrink-0 z-20 min-h-[40px]">
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full hover:bg-foreground/20"
                onClick={() => closeFullscreenPlayer()}
              >
                <ChevronDown className="size-5" />
              </Button>
            </div>

            <div className="flex-1 flex items-center justify-center min-h-0 px-6">
              <FullscreenSongArtwork />
            </div>

            <div className="shrink-0 px-4 pt-4">
              <MobileSongInfoRow />
            </div>

            <div className="shrink-0 px-4 pt-2">
              <FullscreenProgress thin />
            </div>

            <div className="shrink-0 flex items-center justify-center gap-1 pt-1">
              <FullscreenControls />
            </div>

            <div className="shrink-0 px-4 pt-1 pb-1">
              <MobileVolumeBar />
            </div>

            <MobileBottomTabs
              view={view}
              setView={setView}
              lyricsDisabled={lyricsDisabled}
            />
          </motion.div>
        )}

        {view === "lyrics" && (
          <motion.div
            key="lyrics-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center gap-1 px-2 pt-1 pb-1 shrink-0 z-20 min-h-[40px]">
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full hover:bg-foreground/20"
                onClick={() => setView("playing")}
              >
                <ChevronLeft className="size-5" />
              </Button>
              <CompactSongInfo />
            </div>

            <div
              className="flex-1 overflow-hidden min-h-0 px-2"
              data-vaul-no-drag
            >
              <MemoLyricsTab />
            </div>

            <div className="shrink-0 px-4 py-1">
              <FullscreenProgress />
            </div>

            <div className="shrink-0 flex items-center justify-center gap-1 py-1">
              <LikeButton />
              <FullscreenControls />
            </div>

            <MobileBottomTabs
              view={view}
              setView={setView}
              lyricsDisabled={lyricsDisabled}
            />
          </motion.div>
        )}

        {view === "queue" && (
          <motion.div
            key="queue-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center gap-1 px-2 pt-1 pb-1 shrink-0 z-20 min-h-[40px]">
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full hover:bg-foreground/20"
                onClick={() => setView("playing")}
              >
                <ChevronLeft className="size-5" />
              </Button>
              <MobileMiniSongInfo />
            </div>

            <div
              className="flex-1 overflow-hidden min-h-0 px-2"
              data-vaul-no-drag
            >
              <MemoSongQueue />
            </div>

            <div className="shrink-0 px-4 py-1">
              <FullscreenProgress />
            </div>

            <div className="shrink-0 flex items-center justify-center gap-1 py-1">
              <LikeButton />
              <FullscreenControls />
            </div>

            <MobileBottomTabs
              view={view}
              setView={setView}
              lyricsDisabled={lyricsDisabled}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
