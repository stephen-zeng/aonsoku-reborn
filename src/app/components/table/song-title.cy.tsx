import { useLocation } from "react-router-dom";
import { TableSongTitle } from "@/app/components/table/song-title";
import { ISong } from "@/types/responses/song";

function LocationDisplay() {
  const location = useLocation();

  return <div data-testid="location-display">{location.pathname}</div>;
}

describe("TableSongTitle", () => {
  beforeEach(() => {
    cy.mockCoverArt();
  });

  it("disables title and artist interaction when text navigation is disabled", () => {
    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];
      const onPlay = cy.stub().as("onPlay");

      cy.mount(
        <div className="w-80">
          <TableSongTitle
            song={song}
            onPlay={onPlay}
          />
          <LocationDisplay />
        </div>,
      );

      cy.getByTestId("track-artist-url")
        .should("have.text", song.artist)
        .and("not.have.attr", "href");

      cy.getByTestId("location-display").should("have.text", "/");

      cy.getByTestId("track-artist-url").click();
      cy.getByTestId("location-display").should("have.text", "/");

      cy.contains(song.title).click();
      cy.get("@onPlay").should("not.have.been.called");
    });
  });

  it("keeps artist navigation enabled when text navigation is allowed", () => {
    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];

      cy.mount(
        <div className="w-80">
          <TableSongTitle song={song} />
          <LocationDisplay />
        </div>,
      );

      cy.getByTestId("track-artist-url")
        .should("have.text", song.artist)
        .and("have.attr", "href", `/library/artists/${song.artistId}`)
        .click();

      cy.getByTestId("location-display").should(
        "have.text",
        `/library/artists/${song.artistId}`,
      );
    });
  });
});
