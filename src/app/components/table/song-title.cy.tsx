import { TableSongTitle } from "@/app/components/table/song-title";
import { ISong } from "@/types/responses/song";

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
        </div>,
      );

      cy.getByTestId("track-artist-url")
        .should("have.text", song.artist)
        .and("not.have.attr", "href");
    });
  });

  it("keeps artist navigation enabled when text navigation is allowed", () => {
    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];

      cy.mount(
        <div className="w-80">
          <TableSongTitle song={song} />
        </div>,
      );

      cy.getByTestId("track-artist-url")
        .should("have.text", song.artist)
        .and("not.have.attr", "href");
    });
  });
});