import { BottomNavigation } from "@/app/layout/bottom-navigation";
import { ROUTES } from "@/routes/routesList";

describe("BottomNavigation", () => {
  beforeEach(() => {
    cy.changeLang("en-US");
    cy.viewport("iphone-x");
  });

  it("keeps the library tab active on shared library routes", () => {
    cy.mount(<BottomNavigation />, {
      routerProps: {
        initialEntries: ["/library/albums/album-1"],
      },
    });

    cy.get(`a[href="${ROUTES.MOBILE.LIBRARY}"]`).should(
      "have.class",
      "text-foreground",
    );
  });
});
