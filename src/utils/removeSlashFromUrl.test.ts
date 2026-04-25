import { describe, expect, it } from "vitest";
import { removeSlashFromUrl } from "./removeSlashFromUrl";

describe("removeSlashFromUrl", () => {
  it("removes trailing slash", () => {
    expect(removeSlashFromUrl("https://example.com/")).toBe(
      "https://example.com",
    );
  });

  it("does not modify URL without trailing slash", () => {
    expect(removeSlashFromUrl("https://example.com")).toBe(
      "https://example.com",
    );
  });

  it("removes only the last slash", () => {
    expect(removeSlashFromUrl("https://example.com/api/")).toBe(
      "https://example.com/api",
    );
  });

  it("handles empty string", () => {
    expect(removeSlashFromUrl("")).toBe("");
  });

  it("handles single slash", () => {
    expect(removeSlashFromUrl("/")).toBe("");
  });
});
