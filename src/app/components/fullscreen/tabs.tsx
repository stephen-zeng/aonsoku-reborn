import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import { useSwipeTabs } from "@/app/hooks/use-swipe-tabs";
import { useFullscreenPlayerState } from "@/store/player.store";
import { FullscreenPlayerTab } from "@/types/playerContext";
import { FullscreenPlayer } from "./player";
import { LyricsTab } from "./lyrics";
import { FullscreenSongQueue } from "./queue";
import { SongInfo } from "./song-info";

const MemoSongQueue = memo(FullscreenSongQueue);
const MemoSongInfo = memo(SongInfo);
const MemoLyricsTab = memo(LyricsTab);
const MemoFullscreenPlayer = memo(FullscreenPlayer);

const getTransform = (
  currentTab: FullscreenPlayerTab,
  tabValue: FullscreenPlayerTab,
) => {
  const positions = {
    queue: {
      queue: "0",
      playing: "-120%",
      lyrics: "-240%",
    },
    playing: {
      queue: "120%",
      playing: "0",
      lyrics: "-120%",
    },
    lyrics: {
      queue: "240%",
      playing: "120%",
      lyrics: "0",
    },
  };

  const translation = positions[tabValue][currentTab];
  return `translate3d(${translation}, 0, 0)`;
};

const playingTabStyles =
  "absolute inset-0 mt-0 h-[calc(100%-64px)] transition-transform duration-300 overscroll-none overflow-hidden";

const scrollableTabStyles =
  "absolute inset-0 mt-0 h-[calc(100%-64px)] overflow-y-auto transition-transform duration-300 overscroll-none";

const triggerStyles =
  "w-full data-[state=active]:bg-foreground data-[state=active]:text-secondary text-foreground drop-shadow-sm";

export function FullscreenTabs() {
  const { fullscreenPlayerTab, setFullscreenPlayerTab } =
    useFullscreenPlayerState();
  const { t } = useTranslation();
  const { onTouchStart, onTouchEnd } = useSwipeTabs(
    fullscreenPlayerTab,
    setFullscreenPlayerTab,
  );

  return (
    <Tabs
      value={fullscreenPlayerTab}
      onValueChange={(value) =>
        setFullscreenPlayerTab(value as FullscreenPlayerTab)
      }
      className="w-full h-full min-h-full"
    >
      <TabsList className="w-full bg-foreground/20 mb-4">
        <TabsTrigger value="queue" className={triggerStyles}>
          {t("fullscreen.queue")}
        </TabsTrigger>
        <TabsTrigger value="playing" className={triggerStyles}>
          {t("fullscreen.playing")}
        </TabsTrigger>
        <TabsTrigger value="lyrics" className={triggerStyles}>
          {t("fullscreen.lyrics")}
        </TabsTrigger>
      </TabsList>
      <div
        className="relative w-full h-full"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <TabsContent
          value="queue"
          className={scrollableTabStyles}
          style={{
            backfaceVisibility: "hidden",
            transform: getTransform(fullscreenPlayerTab, "queue"),
          }}
          forceMount={true}
        >
          <MemoSongQueue />
        </TabsContent>
        <TabsContent
          value="playing"
          className={playingTabStyles}
          style={{
            backfaceVisibility: "hidden",
            transform: getTransform(fullscreenPlayerTab, "playing"),
          }}
          forceMount={true}
        >
          <div className="flex flex-col h-full justify-center sm:justify-start px-0">
            <MemoSongInfo />
            <div className="sm:hidden mt-auto pb-2 px-2">
              <MemoFullscreenPlayer />
            </div>
          </div>
        </TabsContent>
        <TabsContent
          value="lyrics"
          className={scrollableTabStyles}
          style={{
            backfaceVisibility: "hidden",
            transform: getTransform(fullscreenPlayerTab, "lyrics"),
          }}
          forceMount={true}
        >
          <MemoLyricsTab />
        </TabsContent>
      </div>
    </Tabs>
  );
}
