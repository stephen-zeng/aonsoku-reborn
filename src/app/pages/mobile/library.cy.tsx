import MobileLibrary from "@/app/pages/mobile/library";
import { useCacheStore } from "@/store/cache.store";
import { useAppStore } from "@/store/app.store";

describe("MobileLibrary", () => {
  beforeEach(() => {
    cy.changeLang("en-US");
    cy.viewport("iphone-x");
    useCacheStore.getState().actions.setIsOnline(false);
    useAppStore.getState().pages.setHideRadiosSection(false);
  });

  it("renders mobile collection rows without desktop sidebar rows", () => {
    cy.mount(<MobileLibrary />, {
      routerProps: {
        initialEntries: ["/mobile/library"],
      },
    });

    cy.contains("Artists").should("be.visible");
    cy.contains("Songs").should("be.visible");
    cy.contains("Albums").should("be.visible");
    cy.contains("Favorites").should("be.visible");
    cy.contains("Playlists").should("be.visible");
    cy.contains("Radios").should("be.visible");
  });
});
