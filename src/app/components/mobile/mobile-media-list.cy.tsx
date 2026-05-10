import { MobileSongList } from "@/app/components/mobile/mobile-media-list";
import type { ISong } from "@/types/responses/song";

describe("MobileSongList", () => {
  beforeEach(() => {
    cy.changeLang("en-US");
    cy.viewport("iphone-x");
    cy.mockCoverArt();
  });

  it("plays a row on tap and exposes a 44px options target", () => {
    cy.fixture("songs/random").then((songs: ISong[]) => {
      const onPlaySong = cy.stub().as("playSong");

      cy.mount(<MobileSongList songs={songs} onPlaySong={onPlaySong} />);

      cy.getByTestId("mobile-song-row").should("have.length", songs.length);
      cy.getByTestId("mobile-song-row").first().click();
      cy.get("@playSong").should("have.been.calledWith", 0);

      cy.getByTestId("mobile-song-options")
        .first()
        .should(($button) => {
          expect($button.outerHeight()).to.be.at.least(44);
          expect($button.outerWidth()).to.be.at.least(44);
        });
    });
  });
});
