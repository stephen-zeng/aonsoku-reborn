import { FullscreenPlayerRouter } from "@/routes/fullscreenRouter";
import { subsonic } from "@/service/subsonic";
import {
  useFullscreenPlayerState,
  usePlayerStore,
} from "@/store/player.store";
import type { ISong } from "@/types/responses/song";
import FullscreenMode from "./page";

function FullscreenModeHarness() {
  const { fullscreenPlayerOpen } = useFullscreenPlayerState();

  return (
    <>
      <FullscreenPlayerRouter />
      <div data-testid="fullscreen-open-state">
        {fullscreenPlayerOpen ? "open" : "closed"}
      </div>
      <FullscreenMode open={fullscreenPlayerOpen}>
        <button type="button">Open fullscreen</button>
      </FullscreenMode>
    </>
  );
}

function prepareFullscreenState(songs: ISong[]) {
  const { actions } = usePlayerStore.getState();

  actions.clearPlayerState();
  actions.setSongList(songs, 0);
  actions.openFullscreenPlayer("playing");
}

describe("FullscreenMode", () => {
  beforeEach(() => {
    cy.changeLang("en-US");
    cy.viewport(375, 667);
    cy.mockCoverArt();
    cy.stub(subsonic.lyrics, "getLyrics").resolves({
      artist: "",
      title: "",
      value: "",
    });
    cy.stub(subsonic.lyrics, "getStructuredLyrics").resolves(null);
  });

  it("closes from a mouse drag on narrow mobile layouts", () => {
    cy.fixture("songs/random").then((songs: ISong[]) => {
      prepareFullscreenState(songs);

      cy.mount(<FullscreenModeHarness />, {
        routerProps: { initialEntries: ["/?player=playing"] },
      });

      cy.getByTestId("fullscreen-open-state").should("have.text", "open");
      cy.getByTestId("fullscreen-playing-view")
        .trigger("pointerdown", {
          eventConstructor: "PointerEvent",
          pointerId: 1,
          pointerType: "mouse",
          button: 0,
          clientX: 180,
          clientY: 180,
          pageX: 180,
          pageY: 180,
        })
        .trigger("pointermove", {
          eventConstructor: "PointerEvent",
          pointerId: 1,
          pointerType: "mouse",
          buttons: 1,
          clientX: 180,
          clientY: 410,
          pageX: 180,
          pageY: 410,
        })
        .trigger("pointerup", {
          eventConstructor: "PointerEvent",
          pointerId: 1,
          pointerType: "mouse",
          button: 0,
          clientX: 180,
          clientY: 410,
          pageX: 180,
          pageY: 410,
        });

      cy.getByTestId("fullscreen-open-state").should("have.text", "closed");
    });
  });
});
