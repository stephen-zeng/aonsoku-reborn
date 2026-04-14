import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ListMusic, MicVocalIcon } from "lucide-react";
import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { useHasLyrics } from "@/app/hooks/use-has-lyrics";
import { cn } from "@/lib/utils";
import { useFullscreenPlayerState } from "@/store/player.store";
import { ArtworkWithInfo } from "./artwork-with-info";
import { FullscreenControlPanel } from "./control-panel";
import { LyricsTab } from "./lyrics";
import { FullscreenSongQueue } from "./queue";
import { FullscreenSettings } from "./settings";

const MemoLyricsTab = memo(LyricsTab);
const MemoSongQueue = memo(FullscreenSongQueue);

const VIEW_TRANSITION = { duration: 0.2, ease: [0.4, 0, 0.2, 1] } as const;

const HEADER_ICON = <ChevronDown className="size-5" />;

const MobileHeader = memo(function MobileHeader({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 pt-2 pb-2 shrink-0 z-20 min-h-[40px]">
      <Button
        variant="ghost"
        size="icon"
        className="size-10 rounded-full hover:bg-foreground/20"
        onClick={onClose}
        aria-label="Close"
      >
        {HEADER_ICON}
      </Button>
      <div className="flex-1" />
      <FullscreenSettings />
    </div>
  );
});

function MobileTabButton({
  icon,
  active,
  disabled = false,
  onClick,
  label,
}: {
  icon: ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      role="tab"
      aria-selected={active}
      className={cn(
        "size-10 rounded-full",
        disabled && "opacity-50 cursor-not-allowed text-foreground/70",
        !disabled &&
          active &&
          "text-foreground hover:text-foreground bg-foreground/10",
        !disabled &&
          !active &&
          "text-foreground/70 hover:text-foreground hover:bg-foreground/10",
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {icon}
    </Button>
  );
}

const MobileBottomTabs = memo(function MobileBottomTabs() {
  const { t } = useTranslation();
  const { fullscreenPlayerTab, setFullscreenPlayerTab } =
    useFullscreenPlayerState();
  const { hasLyrics } = useHasLyrics();

  const lyricsDisabled = hasLyrics === false;

  return (
    <div
      className="shrink-0 flex items-center justify-center gap-4 pt-1 pb-2"
      role="tablist"
    >
      <MobileTabButton
        icon={<MicVocalIcon className="size-5" />}
        label={t("fullscreen.lyrics")}
        active={fullscreenPlayerTab === "lyrics"}
        disabled={lyricsDisabled}
        onClick={() =>
          setFullscreenPlayerTab(
            fullscreenPlayerTab === "lyrics" ? "playing" : "lyrics",
          )
        }
      />
      <MobileTabButton
        icon={<ListMusic className="size-5" />}
        label={t("fullscreen.queue")}
        active={fullscreenPlayerTab === "queue"}
        onClick={() =>
          setFullscreenPlayerTab(
            fullscreenPlayerTab === "queue" ? "playing" : "queue",
          )
        }
      />
    </div>
  );
});

export const MobileLayout = memo(function MobileLayout() {
  const { closeFullscreenPlayer, fullscreenPlayerTab } =
    useFullscreenPlayerState();

  return (
    <div className="flex flex-col h-full w-full">
      <MobileHeader onClose={() => closeFullscreenPlayer()} />

      <div className="flex-1 min-h-0 flex flex-col">
        <AnimatePresence mode="wait">
          {fullscreenPlayerTab === "playing" && (
            <motion.div
              key="playing-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={VIEW_TRANSITION}
              className="flex flex-col items-center overflow-hidden pt-2 flex-1 min-h-0"
            >
              <ArtworkWithInfo />
            </motion.div>
          )}

          {fullscreenPlayerTab === "lyrics" && (
            <motion.div
              key="lyrics-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={VIEW_TRANSITION}
              className="flex-1 overflow-hidden min-h-0 px-2"
              data-vaul-no-drag
            >
              <MemoLyricsTab />
            </motion.div>
          )}

          {fullscreenPlayerTab === "queue" && (
            <motion.div
              key="queue-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={VIEW_TRANSITION}
              className="flex-1 overflow-hidden min-h-0 px-2"
              data-vaul-no-drag
            >
              <MemoSongQueue />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <FullscreenControlPanel variant="mobile" />
      <MobileBottomTabs />
    </div>
  );
});
