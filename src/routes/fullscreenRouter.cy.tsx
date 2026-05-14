import { useLocation, useNavigate } from "react-router-dom";
import { MobileLayout } from "@/app/components/fullscreen/mobile-layout";
import {
  FullscreenPlayerRouter,
  openFullscreenPlayerWithHistory,
  setFullscreenTabWithHistory,
} from "@/routes/fullscreenRouter";
import { useFullscreenPlayerState, usePlayerStore } from "@/store/player.store";
import type { ISong } from "@/types/responses/song";

const BASE_ENTRY = "/mobile/library?foo=bar";

function preparePlayerState(songs: ISong[]) {
  const { actions } = usePlayerStore.getState();

  actions.clearPlayerState();
  actions.closeFullscreenPlayer();
  actions.setFullscreenPlayerTab("playing");
  actions.setSongList(songs, 0);
}

function FullscreenHistoryHarness() {
  const location = useLocation();
  const navigate = useNavigate();
  const { fullscreenPlayerOpen, fullscreenPlayerTab } = useFullscreenPlayerState();

  return (
    <div className="h-screen w-screen">
      <FullscreenPlayerRouter />
      <MobileLayout />

      <div data-testid="location-search">{location.search}</div>
      <div data-testid="fullscreen-open">
        {fullscreenPlayerOpen ? "open" : "closed"}
      </div>
      <div data-testid="fullscreen-tab">{fullscreenPlayerTab}</div>

      <button onClick={() => openFullscreenPlayerWithHistory("playing")}>
        open-playing
      </button>
      <button onClick={() => openFullscreenPlayerWithHistory("queue")}>
        open-queue
      </button>
      <button onClick={() => setFullscreenTabWithHistory("lyrics")}>
        tab-lyrics
      </button>
      <button onClick={() => setFullscreenTabWithHistory("queue")}>
        tab-queue
      </button>
      <button onClick={() => setFullscreenTabWithHistory("playing")}>
        tab-playing
      </button>
      <button onClick={() => setFullscreenTabWithHistory("customLyrics")}>
        tab-customLyrics
      </button>
      <button onClick={() => navigate(-1)}>go-back</button>
    </div>
  );
}

function mountHarness() {
  cy.mount(<FullscreenHistoryHarness />, {
    routerProps: {
      initialEntries: [BASE_ENTRY],
    },
  });
}

describe("fullscreenRouter mobile history", () => {
  beforeEach(() => {
    cy.changeLang("en-US");
    cy.viewport("iphone-x");
    cy.mockCoverArt();

    cy.fixture("songs/random").then((songs: ISong[]) => {
      preparePlayerState(songs);
      mountHarness();
    });
  });

  it("closes immediately after a single back from the playing tab", () => {
    cy.contains("open-playing").click();

    cy.getByTestId("location-search").should(
      "have.text",
      "?player=playing",
    );
    cy.getByTestId("fullscreen-open").should("have.text", "open");
    cy.getByTestId("fullscreen-tab").should("have.text", "playing");

    cy.contains("go-back").click();

    cy.getByTestId("fullscreen-open").should("have.text", "closed");
  });

  it("returns to playing first when opening the queue directly", () => {
    cy.contains("open-queue").click();

    cy.getByTestId("location-search").should(
      "have.text",
      "?player=queue",
    );
    cy.getByTestId("fullscreen-tab").should("have.text", "queue");

    cy.contains("go-back").click();

    cy.getByTestId("location-search").should(
      "have.text",
      "?player=playing",
    );
    cy.getByTestId("fullscreen-tab").should("have.text", "playing");

    cy.contains("go-back").click();

    cy.getByTestId("fullscreen-open").should("have.text", "closed");
  });

  it("collapses repeated secondary tab switches into a single back step", () => {
    cy.contains("open-playing").click();

    cy.getByTestId("fullscreen-tab").should("have.text", "playing");
  });

  it("does not resurrect a secondary tab after toggling back to playing", () => {
    cy.contains("open-playing").click();
    cy.contains("tab-lyrics").click();
    cy.contains("tab-playing").click();

    cy.getByTestId("location-search").should(
      "have.text",
      "?player=playing",
    );
    cy.getByTestId("fullscreen-tab").should("have.text", "playing");

    cy.contains("go-back").click();

    cy.getByTestId("fullscreen-open").should("have.text", "closed");
  });

  it("uses the close button to exit immediately from a secondary tab", () => {
    cy.contains("open-queue").click();

    cy.get('button[aria-label="Close"]').click();

    cy.getByTestId("fullscreen-open").should("have.text", "closed");
  });

  it("navigates to customLyrics tab and back to playing", () => {
    cy.contains("open-playing").click();

    cy.contains("tab-customLyrics").click();

    cy.getByTestId("location-search").should(
      "have.text",
      "?foo=bar&player=customLyrics",
    );
    cy.getByTestId("fullscreen-tab").should("have.text", "customLyrics");

    cy.contains("go-back").click();

    cy.getByTestId("location-search").should(
      "have.text",
      "?foo=bar&player=playing",
    );
    cy.getByTestId("fullscreen-tab").should("have.text", "playing");
  });

  it("collapses customLyrics tab changes into a single back step", () => {
    cy.contains("open-playing").click();
    cy.contains("tab-lyrics").click();
    cy.contains("tab-customLyrics").click();

    cy.getByTestId("location-search").should(
      "have.text",
      "?foo=bar&player=customLyrics",
    );
    cy.getByTestId("fullscreen-tab").should("have.text", "customLyrics");

    cy.contains("go-back").click();

    cy.getByTestId("location-search").should(
      "have.text",
      "?foo=bar&player=playing",
    );
    cy.getByTestId("fullscreen-tab").should("have.text", "playing");
  });
});
