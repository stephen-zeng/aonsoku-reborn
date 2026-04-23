import { describe, expect, it } from "vitest";
import { isValidServerUrl, normalizeServerUrl } from "./serverUrl";

describe("normalizeServerUrl", () => {
  it("trims whitespace and removes trailing slash", () => {
    expect(normalizeServerUrl("  https://example.com/  ")).toBe(
      "https://example.com",
    );
  });

  it("does not modify URL without trailing slash", () => {
    expect(normalizeServerUrl("https://example.com")).toBe("https://example.com");
  });

  it("trims but keeps URL with no slash", () => {
    expect(normalizeServerUrl("  https://example.com  ")).toBe(
      "https://example.com",
    );
  });
});

describe("isValidServerUrl", () => {
  it("accepts http URLs", () => {
    expect(isValidServerUrl("http://localhost")).toBe(true);
  });

  it("accepts https URLs", () => {
    expect(isValidServerUrl("https://navidrome.example.com")).toBe(true);
  });

  it("rejects ftp URLs", () => {
    expect(isValidServerUrl("ftp://files.example.com")).toBe(false);
  });

  it("rejects non-URL strings", () => {
    expect(isValidServerUrl("not-a-url")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidServerUrl("")).toBe(false);
  });

  it("rejects javascript: URLs", () => {
    expect(isValidServerUrl("javascript:alert(1)")).toBe(false);
  });
});