import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { useFullscreenPlayerState, usePlayerStore } from "@/store/player.store";
import { ArtworkWithInfo } from "./artwork-with-info";
import { FullscreenControlPanel } from "./control-panel";
import { LyricsTab } from "./lyrics";
import { FullscreenSongQueue } from "./queue";
import { FullscreenSettings } from "./settings";
import { CompactSongInfo } from "./song-info";

const MemoLyricsTab = memo(LyricsTab);
const MemoSongQueue = memo(FullscreenSongQueue);

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

function MobileHeader({
  icon,
  onClick,
  label,
  children,
}: {
  icon: ReactNode;
  onClick: () => void;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 px-2 pt-1 pb-1 shrink-0 z-20 min-h-[40px]">
      <Button
        variant="ghost"
        size="icon"
        className="size-10 rounded-full hover:bg-foreground/20"
        onClick={onClick}
        aria-label={label}
      >
        {icon}
      </Button>
      {children ? (
        <div className="min-w-0 flex-1">{children}</div>
      ) : (
        <div className="flex-1" />
      )}
      <FullscreenSettings />
    </div>
  );
}

export const MobileLayout = memo(function MobileLayout() {
  const { t } = useTranslation();
  const { closeFullscreenPlayer, fullscreenPlayerTab, setFullscreenPlayerTab } =
    useFullscreenPlayerState();

  return (
    <div className="flex flex-col h-full w-full">
      <AnimatePresence mode="wait">
        {fullscreenPlayerTab === "playing" && (
          <motion.div
            key="playing-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col h-full"
          >
            <MobileHeader
              icon={<ChevronDown className="size-5" />}
              onClick={() => closeFullscreenPlayer()}
            />

            <div className="flex-1 flex flex-col items-center justify-center min-h-0">
              <ArtworkWithInfo />
            </div>

            <FullscreenControlPanel variant="mobile" />
          </motion.div>
        )}

        {fullscreenPlayerTab === "lyrics" && (
          <motion.div
            key="lyrics-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col h-full"
          >
            <MobileHeader
              icon={<ChevronLeft className="size-5" />}
              label={t("mobile.library.back")}
              onClick={() => setFullscreenPlayerTab("playing")}
            >
              <CompactSongInfo />
            </MobileHeader>

            <div
              className="flex-1 overflow-hidden min-h-0 px-2"
              data-vaul-no-drag
            >
              <MemoLyricsTab />
            </div>

            <FullscreenControlPanel variant="mobile-secondary" />
          </motion.div>
        )}

        {fullscreenPlayerTab === "queue" && (
          <motion.div
            key="queue-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col h-full"
          >
            <MobileHeader
              icon={<ChevronLeft className="size-5" />}
              label={t("mobile.library.back")}
              onClick={() => setFullscreenPlayerTab("playing")}
            >
              <MobileMiniSongInfo />
            </MobileHeader>

            <div
              className="flex-1 overflow-hidden min-h-0 px-2"
              data-vaul-no-drag
            >
              <MemoSongQueue />
            </div>

            <FullscreenControlPanel variant="mobile-secondary" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
