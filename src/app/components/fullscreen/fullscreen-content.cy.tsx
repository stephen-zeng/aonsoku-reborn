import { subsonic } from "@/service/subsonic";
import { usePlayerStore } from "@/store/player.store";
import type { FullscreenPlayerTab } from "@/types/playerContext";
import type { ISong } from "@/types/responses/song";
import { FullscreenContent } from "./fullscreen-content";

function mountFullscreenContent() {
  cy.mount(
    <div className="h-screen w-screen">
      <FullscreenContent />
    </div>,
  );
}

function prepareFullscreenState(
  songs: ISong[],
  tab: FullscreenPlayerTab,
  desktopView: "queue" | "lyrics" | null = "queue",
) {
  const { actions } = usePlayerStore.getState();

  actions.clearPlayerState();
  actions.closeFullscreenPlayer();
  actions.setFullscreenPlayerTab("playing");
  actions.setDesktopFullscreenPanelView(desktopView);
  actions.setSongList(songs, 0);
  actions.openFullscreenPlayer(tab);
}

describe("FullscreenContent", () => {
  beforeEach(() => {
    cy.changeLang("en-US");
    cy.mockCoverArt();
    cy.stub(subsonic.lyrics, "getLyrics").resolves({
      artist: "",
      title: "",
      value: "",
    });
    cy.stub(subsonic.lyrics, "getStructuredLyrics").resolves(null);
  });

  it("renders the mobile layout in portrait viewports", () => {
    cy.viewport(375, 667);

    cy.fixture("songs/random").then((songs: ISong[]) => {
      prepareFullscreenState(songs, "playing");

      mountFullscreenContent();

      cy.getByTestId("fullscreen-mobile-layout").should("be.visible");
      cy.getByTestId("fullscreen-desktop-layout").should("not.exist");
      cy.get('[data-testid="fullscreen-drag-handle"]').should("be.visible");
      cy.get('[role="tablist"]').should("be.visible");
    });
  });

  it("renders the desktop layout in landscape viewports", () => {
    cy.viewport(667, 375);

    cy.fixture("songs/random").then((songs: ISong[]) => {
      prepareFullscreenState(songs, "playing", null);

      mountFullscreenContent();

      cy.getByTestId("fullscreen-desktop-layout").should("be.visible");
      cy.getByTestId("fullscreen-mobile-layout").should("not.exist");
      cy.get('[role="tablist"]').should("not.exist");
    });
  });

  it("bridges the queue tab into the desktop side panel in landscape", () => {
    cy.viewport(667, 375);

    cy.fixture("songs/random").then((songs: ISong[]) => {
      prepareFullscreenState(songs, "queue", null);

      mountFullscreenContent();

      cy.getByTestId("fullscreen-desktop-side-panel").should(
        "have.attr",
        "data-view",
        "queue",
      );
      cy.contains("Continue Playing").should("be.visible");
    });
  });

  it("bridges the lyrics tab into the desktop side panel in landscape", () => {
    cy.viewport(667, 375);

    cy.fixture("songs/random").then((songs: ISong[]) => {
      prepareFullscreenState(songs, "lyrics", null);

      mountFullscreenContent();

      cy.getByTestId("fullscreen-desktop-side-panel").should(
        "have.attr",
        "data-view",
        "lyrics",
      );
      cy.contains("No lyrics found").should("be.visible");
    });
  });
});
