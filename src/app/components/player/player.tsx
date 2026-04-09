import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, SkipForward } from "lucide-react";
import { MiniPlayerButton } from "@/app/components/mini-player/button";
import { RadioInfo } from "@/app/components/player/radio-info";
import { TrackInfo } from "@/app/components/player/track-info";
import { Button } from "@/app/components/ui/button";
import { getSongStreamUrl } from "@/api/httpClient";
import {
  getVolume,
  usePlayerActions,
  usePlayerIsPlaying,
  usePlayerLoop,
  usePlayerMediaType,
  usePlayerRef,
  usePlayerSonglist,
  useIsRemoteControlActive,
  useReplayGainState,
  usePlayerPrevAndNext,
  usePlayerDuration,
  useFullscreenPlayerState,
} from "@/store/player.store";
import { LoopState } from "@/types/playerContext";
import { hasPiPSupport } from "@/utils/browser";
import { ReplayGainParams } from "@/utils/replayGain";
import { manageMediaSession } from "@/utils/setMediaSession";
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const radioRef = useRef<HTMLAudioElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const { openFullscreenPlayer } = useFullscreenPlayerState();
  const {
    setAudioPlayerRef,
    setCurrentDuration,
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
  const audioPlayerRef = usePlayerRef();
  const isRemoteControlActive = useIsRemoteControlActive();
  const { replayGainType, replayGainPreAmp, replayGainDefaultGain } =
    useReplayGainState();
  const { hasNext } = usePlayerPrevAndNext();
  const currentDuration = usePlayerDuration();

  const song = currentList[currentSongIndex];
  const radio = radioList[currentSongIndex];
  const audioSrc = song?.id ? getSongStreamUrl(song.id) : "";

  const getAudioRef = useCallback(() => {
    if (isRadio) return radioRef;

    return audioRef;
  }, [isRadio]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: audioRef needed
  useEffect(() => {
    if (!isSong && !song) return;
    if (isRemoteControlActive) return;

    if (audioPlayerRef === null && audioRef.current)
      setAudioPlayerRef(audioRef.current);
  }, [
    audioPlayerRef,
    audioRef,
    isRemoteControlActive,
    isSong,
    setAudioPlayerRef,
    song,
  ]);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);

    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  const setupDuration = useCallback(() => {
    const audio = getAudioRef().current;
    if (!audio) return;

    if (isSong && song) {
      setCurrentDuration(song.duration);
    }

    const progress = getCurrentProgress();
    audio.currentTime = progress;
  }, [getAudioRef, isSong, song, setCurrentDuration, getCurrentProgress]);

  const setupProgress = useCallback(() => {
    const audio = getAudioRef().current;
    if (!audio) return;

    const currentProgress = Math.floor(audio.currentTime);
    setProgress(currentProgress);

    // Update media session position state for iOS and other platforms
    if (currentDuration && currentDuration > 0) {
      manageMediaSession.setPositionState(
        currentDuration,
        currentProgress,
        audio.playbackRate,
      );
    }
  }, [getAudioRef, setProgress, currentDuration]);

  const setupInitialVolume = useCallback(() => {
    const audio = getAudioRef().current;
    if (!audio) return;

    audio.volume = getVolume() / 100;
  }, [getAudioRef]);

  function getTrackReplayGain(): ReplayGainParams {
    const preAmp = replayGainPreAmp;
    const defaultGain = replayGainDefaultGain;

    if (!song || !song.replayGain) {
      return { gain: defaultGain, peak: 1, preAmp };
    }

    if (replayGainType === "album") {
      const { albumGain = defaultGain, albumPeak = 1 } = song.replayGain;
      return { gain: albumGain, peak: albumPeak, preAmp };
    }

    const { trackGain = defaultGain, trackPeak = 1 } = song.replayGain;
    return { gain: trackGain, peak: trackPeak, preAmp };
  }

  const handleFooterClick = useCallback(
    (event: React.MouseEvent) => {
      if (!isMobile || window.innerWidth >= 640) return;

      // Check if the click target is a control button or interactive element
      const target = event.target as HTMLElement;
      const isControlButton = target.closest("button") !== null;
      const isSlider = target.closest('[role="slider"]') !== null;
      const isInteractive = isControlButton || isSlider;

      if (!isInteractive) {
        openFullscreenPlayer("playing");
      }
    },
    [isMobile, openFullscreenPlayer],
  );

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

          {isSong && (
            <MemoPlayerProgress
              audioRef={getAudioRef()}
              isBuffering={isBuffering}
            />
          )}
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
          replayGain={getTrackReplayGain()}
          src={audioSrc}
          autoPlay={isPlaying}
          audioRef={audioRef}
          loop={loopState === LoopState.One}
          onPlay={() => setPlayingState(true)}
          onPause={() => setPlayingState(false)}
          onLoadedMetadata={setupDuration}
          onTimeUpdate={setupProgress}
          onEnded={handleSongEnded}
          onLoadStart={setupInitialVolume}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
          data-testid="player-song-audio"
        />
      )}

      {isRadio && radio && !isRemoteControlActive && (
        <MemoAudioPlayer
          src={radio.streamUrl}
          autoPlay={isPlaying}
          audioRef={radioRef}
          onPlay={() => setPlayingState(true)}
          onPause={() => setPlayingState(false)}
          onLoadStart={setupInitialVolume}
          data-testid="player-radio-audio"
        />
      )}
    </footer>
  );
}
