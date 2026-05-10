import { ThemeSettingsPicker } from "@/app/components/settings/pages/appearance/theme";

describe("ThemeSettingsPicker", () => {
  beforeEach(() => {
    cy.changeLang("en-US");
    cy.viewport("iphone-x");
  });

  it("uses mobile-sized mode controls and a two-column theme grid", () => {
    cy.mount(<ThemeSettingsPicker />);

    cy.contains("button", "Light").should(($button) => {
      expect($button.outerHeight()).to.be.at.least(44);
    });

    cy.contains("button", "Light").click();
    cy.get("button.text-left").should("have.length.at.least", 2);
  });
});
