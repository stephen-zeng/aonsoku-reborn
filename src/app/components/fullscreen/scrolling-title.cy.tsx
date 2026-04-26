import { ReactNode } from "react";
import { ScrollingTitle } from "./scrolling-title";

const LONG_TEXT =
  "A very long fullscreen title that should keep scrolling without creating extra horizontal whitespace when the right panel is open ".repeat(
    4,
  );
const LONG_SUBTITLE =
  "Artist Alpha, Artist Beta, Artist Gamma, Artist Delta, Artist Epsilon";

function assertNoHorizontalOverflow(testId: string) {
  cy.getByTestId(testId).should(($el) => {
    const element = $el[0];
    expect(element.scrollWidth).to.equal(element.clientWidth);
  });
}

function ConstrainedTitle({
  children,
  containerTestId,
}: {
  children: ReactNode;
  containerTestId: string;
}) {
  return (
    <div className="w-[240px] overflow-x-auto" data-testid={containerTestId}>
      <ScrollingTitle>{children}</ScrollingTitle>
    </div>
  );
}

describe("ScrollingTitle", () => {
  beforeEach(() => {
    cy.viewport("macbook-11");
  });

  it("keeps constrained long titles from creating horizontal overflow", () => {
    cy.mount(
      <ConstrainedTitle containerTestId="constrained-title">
        <h2 className="text-2xl font-bold tracking-tight">{LONG_TEXT}</h2>
      </ConstrainedTitle>,
    );

    cy.getByTestId("scrolling-title").should("have.css", "position", "relative");
    assertNoHorizontalOverflow("constrained-title");
  });

  it("renders short titles without switching to the scrolling layout", () => {
    cy.mount(
      <ConstrainedTitle containerTestId="short-title">
        <p className="text-sm text-foreground/70">Short title</p>
      </ConstrainedTitle>,
    );

    cy.getByTestId("scrolling-title").should("have.css", "position", "static");
    assertNoHorizontalOverflow("short-title");
  });

  it("does not widen a simulated half-width fullscreen info column", () => {
    cy.mount(
      <div className="w-[960px] overflow-x-auto" data-testid="fullscreen-shell">
        <div className="flex h-[240px] w-full overflow-hidden rounded-md border">
          <div className="flex h-full w-1/2 min-w-0 flex-col px-8 pt-6 pb-4">
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
              <div className="flex w-full min-w-0 max-w-[clamp(280px,85vw,480px)] flex-col">
                <div className="w-full min-w-0 pb-3">
                  <ScrollingTitle>
                    <p className="text-sm text-foreground/70">{LONG_TEXT}</p>
                  </ScrollingTitle>
                </div>

                <div className="flex min-w-0 items-start justify-between gap-2 pt-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex w-full min-w-0 flex-col gap-1">
                      <ScrollingTitle>
                        <h2 className="text-2xl font-bold tracking-tight">
                          {LONG_TEXT}
                        </h2>
                      </ScrollingTitle>
                      <ScrollingTitle>
                        <p className="text-sm text-foreground/70">
                          {LONG_SUBTITLE}
                        </p>
                      </ScrollingTitle>
                    </div>
                  </div>
                  <button className="shrink-0 rounded border px-2 py-1">
                    Like
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="h-full w-1/2 shrink-0 border-l p-4">Right panel</div>
        </div>
      </div>,
    );

    assertNoHorizontalOverflow("fullscreen-shell");
  });
});
