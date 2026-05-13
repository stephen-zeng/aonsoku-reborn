import { type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { ISong } from "@/types/responses/song";

import { TrackInfo } from "./track-info";

function LocationDisplay() {
  const location = useLocation();

  return <div data-testid="location-display">{location.pathname}</div>;
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 w-full">{children}</div>
      <LocationDisplay />
    </div>
  );
}

function mountTrackInfo(song: ISong | undefined) {
  cy.mount(
    <Wrapper>
      <TrackInfo song={song} />
    </Wrapper>,
  );
}

function createMatchMediaList(query: string, matches: boolean): MediaQueryList {
  return {
    addEventListener: () => {},
    addListener: () => {},
    dispatchEvent: () => false,
    matches,
    media: query,
    onchange: null,
    removeEventListener: () => {},
    removeListener: () => {},
  } as MediaQueryList;
}

function stubMatchMedia(matchesByQuery: Record<string, boolean>) {
  cy.window().then((win) => {
    const nativeMatchMedia = win.matchMedia.bind(win);

    cy.stub(win, "matchMedia").callsFake((query: string) => {
      if (query in matchesByQuery) {
        return createMatchMediaList(query, matchesByQuery[query]);
      }

      return nativeMatchMedia(query);
    });
  });
}

function getVisibleTrackTitle() {
  return cy.getByTestId("track-title").eq(1);
}

function getVisibleAlbumLink(albumId: string) {
  return cy.get(`a[href="/library/albums/${albumId}"]`).eq(1);
}

describe("TrackInfo Component", () => {
  beforeEach(() => {
    cy.mockCoverArt();
    cy.viewport("macbook-11");
  });

  it("displays track info without artist navigation when artist id is missing", () => {
    cy.fixture("songs/song").then((song: ISong) => {
      mountTrackInfo(song);

      cy.getByTestId("track-image").as("trackImage");

      cy.get("@trackImage").should("be.visible");
      cy.get("@trackImage").invoke("height").should("equal", 70);
      cy.get("@trackImage").invoke("width").should("equal", 70);

      getVisibleTrackTitle().should("be.visible").and("have.text", song.title);

      cy.getByTestId("track-artist-url")
        .should("be.visible")
        .and("have.text", song.artist)
        .and("not.have.attr", "href");
    });
  });

  it("navigates to the album on mouse click", () => {
    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];

      mountTrackInfo(song);

      getVisibleAlbumLink(song.albumId).click();

      cy.getByTestId("location-display").should(
        "have.text",
        `/library/albums/${song.albumId}`,
      );
    });
  });

  it("navigates to the artist on mouse click", () => {
    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];

      mountTrackInfo(song);

      cy.getByTestId("track-artist-url").click();

      cy.getByTestId("location-display").should(
        "have.text",
        `/library/artists/${song.artistId}`,
      );
    });
  });

  it("prevents album navigation when the click is touch-activated", () => {
    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];

      mountTrackInfo(song);

      getVisibleAlbumLink(song.albumId)
        .trigger("pointerdown", {
          button: 0,
          eventConstructor: "PointerEvent",
          isPrimary: true,
          pointerType: "touch",
        })
        .click();

      cy.getByTestId("location-display").should("have.text", "/");
    });
  });

  it("prevents artist navigation when the click is touch-activated", () => {
    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];

      mountTrackInfo(song);

      cy.getByTestId("track-artist-url")
        .trigger("pointerdown", {
          button: 0,
          eventConstructor: "PointerEvent",
          isPrimary: true,
          pointerType: "touch",
        })
        .click();

      cy.getByTestId("location-display").should("have.text", "/");
    });
  });

  it("removes link affordances when hover is unavailable", () => {
    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];

      stubMatchMedia({ "(hover: hover)": false });
      mountTrackInfo(song);

      getVisibleTrackTitle()
        .should("not.have.class", "cursor-pointer")
        .invoke("attr", "class")
        .should("not.contain", "hover-supported:underline");

      cy.getByTestId("track-artist-url")
        .find("span")
        .should("not.have.class", "cursor-pointer")
        .invoke("attr", "class")
        .should("not.contain", "hover-supported:underline")
        .and("not.contain", "hover-supported:text-foreground");
    });
  });

  it("disables song text navigation on mobile screens", () => {
    cy.viewport("iphone-x");

    cy.fixture("songs/random").then((songs: ISong[]) => {
      const song = songs[1];

      mountTrackInfo(song);

      getVisibleTrackTitle().should("be.visible").and("have.text", song.title);

      cy.getByTestId("track-artist-url")
        .should("be.visible")
        .and("have.text", song.artist)
        .and("not.have.attr", "href");

      cy.get(`a[href="/library/albums/${song.albumId}"]`).should("not.exist");
      cy.get(`a[href="/library/artists/${song.artistId}"]`).should(
        "not.exist",
      );
    });
  });

  describe("English", () => {
    beforeEach(() => {
      cy.changeLang("en-US");
    });

    it("displays a message if no audio is playing", () => {
      mountTrackInfo(undefined);

      cy.getByTestId("song-no-playing-icon")
        .should("be.visible")
        .and("have.class", "lucide-audio-lines");

      cy.getByTestId("song-no-playing-label")
        .should("be.visible")
        .and("have.text", "No song playing");
    });

    it("creates the fullscreen button and shows the tooltip", () => {
      cy.fixture("songs/song").then((song: ISong) => {
        mountTrackInfo(song);

        cy.getByTestId("track-fullscreen-button")
          .should("exist")
          .and("have.css", "opacity", "0");

        cy.getByTestId("track-fullscreen-button").wait(1500).realHover();
        cy.contains("Switch to fullscreen").should("be.visible");
      });
    });
  });

  describe("Portuguese", () => {
    beforeEach(() => {
      cy.changeLang("pt-BR");
    });

    it("displays a message if no audio is playing", () => {
      mountTrackInfo(undefined);

      cy.getByTestId("song-no-playing-icon")
        .should("be.visible")
        .and("have.class", "lucide-audio-lines");

      cy.getByTestId("song-no-playing-label")
        .should("be.visible")
        .and("have.text", "Nenhuma música tocando");
    });

    it("creates the fullscreen button and shows the tooltip", () => {
      cy.fixture("songs/song").then((song: ISong) => {
        mountTrackInfo(song);

        cy.getByTestId("track-fullscreen-button")
          .should("exist")
          .and("have.css", "opacity", "0");

        cy.getByTestId("track-fullscreen-button").wait(1500).realHover();
        cy.contains("Mudar para tela cheia").should("be.visible");
      });
    });
  });
});
