import { usePlayerStore } from "@/store/player.store";
import { ISong } from "@/types/responses/song";
import { AudioPlayer } from "./audio";
import { useRef } from "react";

function Harness({ src, isPlaying }: { src: string; isPlaying: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  return (
    <AudioPlayer
      audioRef={audioRef}
      src={src}
      autoPlay={isPlaying}
      data-testid="test-audio"
    />
  );
}

function dispatchNetworkError(el: HTMLAudioElement) {
  const mediaError = { code: MediaError.MEDIA_ERR_NETWORK, message: "" };
  Object.defineProperty(el, "error", {
    get: () => mediaError,
    configurable: true,
  });
  el.dispatchEvent(new Event("error"));
}

function dispatchReadyEvents(el: HTMLAudioElement) {
  const canPlayEvent = new Event("canplay");
  Object.defineProperty(canPlayEvent, "target", {
    value: el,
    writable: false,
  });
  Object.defineProperty(canPlayEvent, "currentTarget", {
    value: el,
    writable: false,
  });
  el.dispatchEvent(canPlayEvent);
}

describe("AudioPlayer error recovery", () => {
  const testSrc = "http://localhost:1420/rest/stream?id=test-song-id";

  beforeEach(() => {
    cy.mockCoverArt();
    cy.mockSongStream();
  });

  afterEach(() => {
    usePlayerStore.getState().actions.clearPlayerState();
  });

  function setupSong(songProgress = 0) {
    cy.fixture("songs/random").then((songs: ISong[]) => {
      usePlayerStore.getState().actions.setSongList(songs, 0);
      usePlayerStore.getState().actions.setPlayingState(true);
      if (songProgress > 0) {
        usePlayerStore.getState().actions.setProgress(songProgress);
      }
    });
  }

  it("should resume from near the original position after a mid-song error", () => {
    cy.clock();
    const midPosition = 90;

    setupSong(midPosition);

    cy.mount(<Harness src={testSrc} isPlaying={true} />);

    cy.getByTestId<HTMLAudioElement>("test-audio").then(($audio) => {
      const el = $audio[0];
      cy.stub(el, "load").as("loadStub");
      cy.stub(el, "play").resolves().as("playStub");
      el.currentTime = midPosition;
    });

    cy.getByTestId<HTMLAudioElement>("test-audio").then(($audio) => {
      usePlayerStore.getState().actions.setProgress(midPosition);
      dispatchNetworkError($audio[0]);
    });

    cy.tick(2000);

    cy.getByTestId<HTMLAudioElement>("test-audio").then(($audio) => {
      dispatchReadyEvents($audio[0]);
    });

    cy.getByTestId<HTMLAudioElement>("test-audio").should(($audio) => {
      const el = $audio[0];
      expect(el.currentTime).to.be.approximately(midPosition, 1);
    });

    cy.then(() => {
      const storeProgress =
        usePlayerStore.getState().playerProgress.progress;
      expect(storeProgress).to.be.approximately(midPosition, 1);
    });
  });

  it("should allow normal seeking after error recovery", () => {
    cy.clock();
    const midPosition = 60;

    setupSong(midPosition);

    cy.mount(<Harness src={testSrc} isPlaying={true} />);

    cy.getByTestId<HTMLAudioElement>("test-audio").then(($audio) => {
      const el = $audio[0];
      el.currentTime = midPosition;
      usePlayerStore.getState().actions.setProgress(midPosition);
      dispatchNetworkError(el);
    });

    cy.tick(2000);

    cy.getByTestId<HTMLAudioElement>("test-audio").then(($audio) => {
      dispatchReadyEvents($audio[0]);
    });

    cy.getByTestId<HTMLAudioElement>("test-audio").then(($audio) => {
      const el = $audio[0];
      el.currentTime = 120;
      usePlayerStore.getState().actions.setProgress(120);
    });

    cy.getByTestId<HTMLAudioElement>("test-audio").should(($audio) => {
      expect($audio[0].currentTime).to.equal(120);
    });

    cy.then(() => {
      expect(usePlayerStore.getState().playerProgress.progress).to.equal(120);
    });

    cy.getByTestId<HTMLAudioElement>("test-audio").then(($audio) => {
      const timeUpdateEvent = new Event("timeupdate");
      Object.defineProperty(timeUpdateEvent, "target", {
        value: $audio[0],
        writable: false,
      });
      $audio[0].dispatchEvent(timeUpdateEvent);
    });
  });

  it("should not stack multiple retries from repeated errors", () => {
    cy.clock();
    const midPosition = 45;

    setupSong(midPosition);

    cy.mount(<Harness src={testSrc} isPlaying={true} />);

    cy.getByTestId<HTMLAudioElement>("test-audio").then(($audio) => {
      const el = $audio[0];
      el.currentTime = midPosition;
      usePlayerStore.getState().actions.setProgress(midPosition);

      Object.defineProperty(el, "paused", {
        get: () => false,
        configurable: true,
      });

      cy.stub(el, "load").as("loadStub");
      cy.stub(el, "play").resolves().as("playStub");

      dispatchNetworkError(el);
      dispatchNetworkError(el);
    });

    cy.tick(4000);

    cy.get("@loadStub").should("have.been.calledOnce");

    cy.getByTestId<HTMLAudioElement>("test-audio").then(($audio) => {
      dispatchReadyEvents($audio[0]);
    });

    cy.getByTestId<HTMLAudioElement>("test-audio").should(($audio) => {
      expect($audio[0].currentTime).to.be.approximately(midPosition, 1);
    });
  });

  it("should not force auto-play when paused during retry", () => {
    cy.clock();

    setupSong(0);

    cy.mount(<Harness src={testSrc} isPlaying={true} />);

    cy.getByTestId<HTMLAudioElement>("test-audio").then(($audio) => {
      const el = $audio[0];
      el.currentTime = 30;
      usePlayerStore.getState().actions.setProgress(30);

      cy.stub(el, "load").as("loadStub");
      cy.stub(el, "play").resolves().as("playStub");

      dispatchNetworkError(el);
    });

    cy.getByTestId<HTMLAudioElement>("test-audio").then(($audio) => {
      $audio[0].pause();
      usePlayerStore.getState().actions.setPlayingState(false);
    });

    cy.tick(2000);

    cy.get("@playStub").should("not.have.been.called");

    cy.getByTestId<HTMLAudioElement>("test-audio").then(($audio) => {
      expect($audio[0].paused).to.be.true;
    });
  });
});