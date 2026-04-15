import { usePlayerStore } from "@/store/player.store";
import type { ISong } from "@/types/responses/song";
import { MobileLayout } from "./mobile-layout";

function mountMobileLayout() {
  cy.mount(
    <div className="h-screen w-screen">
      <MobileLayout />
    </div>,
  );
}

describe("MobileLayout", () => {
  beforeEach(() => {
    cy.changeLang("en-US");
    cy.viewport("iphone-x");
    cy.mockCoverArt();
  });

  it("renders a single settings trigger in the mobile header", () => {
    cy.fixture("songs/random").then((songs: ISong[]) => {
      const { actions } = usePlayerStore.getState();

      actions.setSongList(songs, 0);
      actions.openFullscreenPlayer("playing");

      mountMobileLayout();

      cy.get('button[aria-label="Settings"]')
        .should("have.length", 1)
        .and("be.visible");
    });
  });

  it("honors the requested queue tab when fullscreen opens on mobile", () => {
    cy.fixture("songs/random").then((songs: ISong[]) => {
      const { actions } = usePlayerStore.getState();

      actions.setSongList(songs, 0);
      actions.openFullscreenPlayer("queue");

      mountMobileLayout();

      cy.contains("Continue Playing").should("be.visible");
      cy.contains(songs[1].title).should("be.visible");

      cy.get('button[aria-label="Queue"]').click();
      cy.contains("Continue Playing").should("not.exist");
      cy.contains(songs[0].title).should("be.visible");
    });
  });

  it("keeps the volume bar visible on compact mobile heights", () => {
    cy.viewport(375, 667);

    cy.fixture("songs/random").then((songs: ISong[]) => {
      const { actions } = usePlayerStore.getState();

      actions.setSongList(songs, 0);
      actions.openFullscreenPlayer("playing");

      mountMobileLayout();

      cy.get('[data-testid="fullscreen-volume-bar"]').should("be.visible");
      cy.get('[role="tablist"]').should("be.visible");
    });
  });
});
