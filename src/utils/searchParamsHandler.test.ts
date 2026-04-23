import { describe, expect, it } from "vitest";
import { SearchParamsHandler } from "./searchParamsHandler";

describe("SearchParamsHandler", () => {
  it("returns the value when param exists", () => {
    const handler = new SearchParamsHandler(new URLSearchParams("foo=bar"));
    expect(handler.getSearchParam("foo", "default")).toBe("bar");
  });

  it("returns fallback when param does not exist", () => {
    const handler = new SearchParamsHandler(new URLSearchParams(""));
    expect(handler.getSearchParam("missing", "fallback")).toBe("fallback");
  });

  it("returns fallback for empty params", () => {
    const handler = new SearchParamsHandler(new URLSearchParams());
    expect(handler.getSearchParam("key", 42)).toBe(42);
  });

  it("handles numeric fallback values", () => {
    const handler = new SearchParamsHandler(new URLSearchParams("count=10"));
    expect(handler.getSearchParam("count", 0)).toBe("10");
  });

  it("works with multiple params", () => {
    const handler = new SearchParamsHandler(
      new URLSearchParams("a=1&b=2&c=3"),
    );
    expect(handler.getSearchParam("b", "")).toBe("2");
  });
});