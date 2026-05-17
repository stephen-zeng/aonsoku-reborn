import { usePlayerStore } from "@/store/player.store";
import { ISong } from "@/types/responses/song";
import { MiniPlayerSongTitle } from "./song-title";

describe("MiniPlayerSongTitle", () => {
  beforeEach(() => {
    cy.mockCoverArt();
  });

  it("displays the song title on mobile screens", () => {
    cy.viewport("iphone-x");

    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];

      usePlayerStore.getState().actions.setSongList([song], 0);

      cy.mount(
        <div className="w-80">
          <MiniPlayerSongTitle />
        </div>,
      );

      cy.getByTestId("track-title").should("contain", song.title);
    });
  });

  it("displays the song title on desktop", () => {
    cy.viewport("macbook-11");

    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];

      usePlayerStore.getState().actions.setSongList([song], 0);

      cy.mount(
        <div className="w-80">
          <MiniPlayerSongTitle />
        </div>,
      );

      cy.getByTestId("track-title").should("contain", song.title);
    });
  });

  it("displays the artist name", () => {
    cy.viewport("macbook-11");

    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];

      usePlayerStore.getState().actions.setSongList([song], 0);

      cy.mount(
        <div className="w-80">
          <MiniPlayerSongTitle />
        </div>,
      );

      cy.getByTestId("track-title").should("contain", song.title);
    });
  });
});