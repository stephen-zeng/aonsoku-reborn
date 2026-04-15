import { Pause, Play, SkipForward } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { getSongStreamUrl } from "@/api/httpClient";
import { MiniPlayerButton } from "@/app/components/mini-player/button";
import { RadioInfo } from "@/app/components/player/radio-info";
import { TrackInfo } from "@/app/components/player/track-info";
import { Button } from "@/app/components/ui/button";
import { usePlayHistory } from "@/app/hooks/use-play-history";
import { usePlayerBreakpoint } from "@/app/hooks/use-player-breakpoint";
import {
  useIsRemoteControlActive,
  usePlayerActions,
  usePlayerIsPlaying,
  usePlayerLoop,
  usePlayerMediaType,
  usePlayerPrevAndNext,
  usePlayerSonglist,
  usePlayerStore,
  useReplayGainState,
} from "@/store/player.store";
import { LoopState } from "@/types/playerContext";
import { openFullscreenPlayerWithHistory } from "@/routes/fullscreenRouter";
import { hasPiPSupport } from "@/utils/browser";
import { isValidDuration } from "@/utils/duration";
import {
  resolveReplayGainParams,
  type ReplayGainParams,
} from "@/utils/replayGain";
import { AudioPlayer } from "./audio";
import { PlayerClearQueueButton } from "./clear-queue-button";
import { PlayerControls } from "./controls";
import { PlayerLikeButton } from "./like-button";
import { PlayerLyricsButton } from "./lyrics-button";
import { PlayerProgress } from "./progress";
import { PlayerQueueButton } from "./queue-button";
import { PlayerVolume } from "./volume";

const MemoTrackInfo = memo(TrackInfo);
const MemoRadioInfo = memo(RadioInfo);
const MemoPlayerControls = memo(PlayerControls);
const MemoPlayerProgress = memo(PlayerProgress);
const MemoPlayerLikeButton = memo(PlayerLikeButton);
const MemoPlayerQueueButton = memo(PlayerQueueButton);
const MemoPlayerClearQueueButton = memo(PlayerClearQueueButton);
const MemoPlayerVolume = memo(PlayerVolume);
const MemoLyricsButton = memo(PlayerLyricsButton);
const MemoMiniPlayerButton = memo(MiniPlayerButton);
const MemoAudioPlayer = memo(AudioPlayer);

export function Player() {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const radioRef = useRef<HTMLAudioElement>(null);
  const isMobile = usePlayerBreakpoint();
  const {
    setAudioPlayerRef,
    setCurrentDuration,
    setIsBuffering: setStoreIsBuffering,
    setProgress,
    setPlayingState,
    handleSongEnded,
    getCurrentProgress,
    togglePlayPause,
    playNextSong,
  } = usePlayerActions();
  const { currentList, currentSongIndex, radioList } = usePlayerSonglist();
  const isPlaying = usePlayerIsPlaying();
  const { isSong, isRadio } = usePlayerMediaType();
  const loopState = usePlayerLoop();
  const isRemoteControlActive = useIsRemoteControlActive();
  const { replayGainType, replayGainPreAmp, replayGainDefaultGain } =
    useReplayGainState();
  const { hasNext } = usePlayerPrevAndNext();

  usePlayHistory();

  const song = currentList[currentSongIndex];
  const radio = radioList[currentSongIndex];
  const songId = song?.id;
  const audioSrc = song?.id ? getSongStreamUrl(song.id) : "";

  const getAudioRef = useCallback(() => {
    if (isRadio) return radioRef;

    return audioRef;
  }, [isRadio]);

  useEffect(() => {
    if (!isSong || !songId) return;
    if (isRemoteControlActive) return;

    const currentAudio = audioRef.current;
    if (
      currentAudio &&
      currentAudio !== usePlayerStore.getState().playerState.audioPlayerRef
    ) {
      setAudioPlayerRef(currentAudio);
    }

    return () => {
      if (currentAudio) {
        setAudioPlayerRef(null);
      }
    };
  }, [isRemoteControlActive, isSong, setAudioPlayerRef, songId]);

  const updateAudioDuration = useCallback(() => {
    const audio = getAudioRef().current;
    if (!audio) return;

    const audioDuration = audio.duration;
    if (isValidDuration(audioDuration)) {
      const roundedDuration = Math.round(audioDuration);
      const currentDur = usePlayerStore.getState().playerState.currentDuration;
      if (currentDur !== roundedDuration) {
        setCurrentDuration(roundedDuration);
      }
    }
  }, [getAudioRef, setCurrentDuration]);

  const setupDuration = useCallback(() => {
    const audio = getAudioRef().current;
    if (!audio) return;

    if (isSong) {
      updateAudioDuration();
    }

    const progress = getCurrentProgress();
    audio.currentTime = progress;
  }, [getAudioRef, isSong, updateAudioDuration, getCurrentProgress]);

  const setupProgress = useCallback(() => {
    const audio = getAudioRef().current;
    if (!audio) return;

    const currentProgress = Math.floor(audio.currentTime);
    setProgress(currentProgress);
  }, [getAudioRef, setProgress]);

  const trackReplayGain = useMemo(
    (): ReplayGainParams =>
      resolveReplayGainParams(
        song?.replayGain,
        replayGainType,
        replayGainPreAmp,
        replayGainDefaultGain,
      ),
    [song, replayGainType, replayGainPreAmp, replayGainDefaultGain],
  );

  const handleFooterClick = useCallback(
    (event: React.MouseEvent) => {
      if (!isMobile || window.innerWidth >= 640) return;

      // Check if the click target is a control button or interactive element
      const target = event.target as HTMLElement;
      const isControlButton = target.closest("button") !== null;
      const isSlider = target.closest('[role="slider"]') !== null;
      const isInteractive = isControlButton || isSlider;

      if (!isInteractive) {
        openFullscreenPlayerWithHistory("playing");
      }
    },
    [isMobile],
  );

  const handleAudioPlay = useCallback(
    () => setPlayingState(true),
    [setPlayingState],
  );
  const handleAudioPause = useCallback(
    () => setPlayingState(false),
    [setPlayingState],
  );
  const handleAudioWaiting = useCallback(
    () => setStoreIsBuffering(true),
    [setStoreIsBuffering],
  );
  const handleAudioPlaying = useCallback(
    () => setStoreIsBuffering(false),
    [setStoreIsBuffering],
  );
  const handleAudioCanPlay = useCallback(() => {
    setStoreIsBuffering(false);
    updateAudioDuration();
  }, [setStoreIsBuffering, updateAudioDuration]);

  const handlePlaybackError = useCallback(() => {
    toast.error(t("warnings.songError"));
  }, [t]);

  const handleReplayGainError = useCallback(() => {
    toast.error(t("warnings.songError"));
  }, [t]);

  return (
    <footer
      className="border-t h-[--player-height] w-full flex items-center fixed bottom-[--bottom-nav-height] left-0 right-0 z-40 bg-background"
      onClick={handleFooterClick}
    >
      <div className="w-full h-full grid grid-cols-[1fr_auto] gap-3 px-3 sm:grid-cols-player sm:gap-2 sm:px-4">
        {/* Track Info */}
        <div className="flex items-center gap-1 w-full sm:gap-2">
          {isSong && <MemoTrackInfo song={song} />}
          {isRadio && <MemoRadioInfo radio={radio} />}
        </div>
        {/* Main Controls */}
        <div className="hidden sm:col-span-2 sm:flex flex-col justify-center items-center px-4 gap-1">
          <MemoPlayerControls song={song} radio={radio} />

          {isSong && <MemoPlayerProgress audioRef={getAudioRef()} />}
        </div>
        {/* Mobile Controls - Only Play/Pause and Next */}
        <div className="flex sm:hidden items-center gap-1">
          <Button
            variant="ghost"
            disabled={!song && !radio}
            onClick={togglePlayPause}
            data-testid={`player-button-${isPlaying ? "pause" : "play"}`}
            className="size-10 p-0"
          >
            {isPlaying ? (
              <Pause className="text-foreground fill-foreground size-5" />
            ) : (
              <Play className="text-foreground fill-foreground size-5" />
            )}
          </Button>
          <Button
            variant="ghost"
            disabled={
              (!song && !radio) || (!hasNext && loopState !== LoopState.All)
            }
            onClick={playNextSong}
            data-testid="player-button-next-mobile"
            className="size-10 p-0"
          >
            <SkipForward className="text-foreground fill-foreground size-5" />
          </Button>
        </div>
        {/* Remain Controls and Volume */}
        <div className="hidden sm:flex items-center w-full justify-end">
          <div className="flex items-center gap-1">
            {isSong && (
              <>
                <MemoPlayerLikeButton disabled={!song} />
                <MemoLyricsButton disabled={!song} />
                <MemoPlayerQueueButton disabled={!song} />
              </>
            )}
            {isRadio && <MemoPlayerClearQueueButton disabled={!radio} />}

            <MemoPlayerVolume
              audioRef={getAudioRef()}
              disabled={!song && !radio}
            />

            {isSong && hasPiPSupport && <MemoMiniPlayerButton />}
          </div>
        </div>
      </div>

      {isSong && song && !isRemoteControlActive && (
        <MemoAudioPlayer
          replayGain={trackReplayGain}
          src={audioSrc}
          autoPlay={isPlaying}
          audioRef={audioRef}
          loop={loopState === LoopState.One}
          onPlay={handleAudioPlay}
          onPause={handleAudioPause}
          onLoadedMetadata={setupDuration}
          onDurationChange={updateAudioDuration}
          onTimeUpdate={setupProgress}
          onEnded={handleSongEnded}
          onWaiting={handleAudioWaiting}
          onPlaying={handleAudioPlaying}
          onCanPlay={handleAudioCanPlay}
          onPlaybackError={handlePlaybackError}
          onReplayGainError={handleReplayGainError}
          data-testid="player-song-audio"
        />
      )}

      {isRadio && radio && !isRemoteControlActive && (
        <MemoAudioPlayer
          src={radio.streamUrl}
          autoPlay={isPlaying}
          audioRef={radioRef}
          onPlay={handleAudioPlay}
          onPause={handleAudioPause}
          onWaiting={handleAudioWaiting}
          onPlaying={handleAudioPlaying}
          onCanPlay={handleAudioCanPlay}
          data-testid="player-radio-audio"
        />
      )}
    </footer>
  );
}
