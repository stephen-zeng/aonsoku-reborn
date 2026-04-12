import { useLocation } from "react-router-dom";
import { usePlayerStore } from "@/store/player.store";
import { ISong } from "@/types/responses/song";
import { MiniPlayerSongTitle } from "./song-title";

function LocationDisplay() {
  const location = useLocation();

  return <div data-testid="location-display">{location.pathname}</div>;
}

function mountMiniPlayerSongTitle() {
  cy.mount(
    <div className="w-80">
      <MiniPlayerSongTitle />
      <LocationDisplay />
    </div>,
  );
}

describe("MiniPlayerSongTitle", () => {
  it("disables title and artist navigation on mobile screens", () => {
    cy.viewport("iphone-x");

    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];

      usePlayerStore.getState().actions.setSongList([song], 0);

      mountMiniPlayerSongTitle();

      cy.getByTestId("track-title").should("have.text", song.title).click();
      cy.contains(song.artist).click();

      cy.getByTestId("location-display").should("have.text", "/");
    });
  });

  it("navigates to the album on desktop when clicking the title", () => {
    cy.viewport("macbook-11");

    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];

      usePlayerStore.getState().actions.setSongList([song], 0);

      mountMiniPlayerSongTitle();

      cy.getByTestId("track-title").should("have.text", song.title).click();

      cy.getByTestId("location-display").should(
        "have.text",
        `/library/albums/${song.albumId}`,
      );
    });
  });

  it("navigates to the artist on desktop when clicking the artist name", () => {
    cy.viewport("macbook-11");

    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];

      usePlayerStore.getState().actions.setSongList([song], 0);

      mountMiniPlayerSongTitle();

      cy.contains(song.artist).click();

      cy.getByTestId("location-display").should(
        "have.text",
        `/library/artists/${song.artistId}`,
      );
    });
  });
});
