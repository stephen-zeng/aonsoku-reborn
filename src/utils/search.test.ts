import { describe, expect, it } from "vitest";
import {
  matchesAllTokens,
  matchesAnyToken,
  normalizeSearchText,
  tokenizeQuery,
} from "./search";

describe("normalizeSearchText", () => {
  it("lowercases text", () => {
    expect(normalizeSearchText("Hello World")).toBe("hello world");
  });

  it("strips diacritics", () => {
    expect(normalizeSearchText("Café Résumé")).toBe("cafe resume");
    expect(normalizeSearchText("Björk")).toBe("bjork");
    expect(normalizeSearchText("Dvořák")).toBe("dvorak");
  });

  it("trims and collapses whitespace", () => {
    expect(normalizeSearchText("  hello   world  ")).toBe("hello world");
  });
});

describe("tokenizeQuery", () => {
  it("splits query into tokens", () => {
    expect(tokenizeQuery("Hello World")).toEqual(["hello", "world"]);
  });

  it("normalizes and filters empty tokens", () => {
    expect(tokenizeQuery("  Café   Résumé  ")).toEqual(["cafe", "resume"]);
  });

  it("returns empty array for empty query", () => {
    expect(tokenizeQuery("")).toEqual([]);
    expect(tokenizeQuery("   ")).toEqual([]);
  });
});

describe("matchesAnyToken", () => {
  it("matches when any token is found in targets", () => {
    const tokens = tokenizeQuery("Pink Floyd");
    expect(matchesAnyToken(tokens, ["Pink Floyd", "Rock"])).toBe(true);
    expect(matchesAnyToken(tokens, ["The Pink"])).toBe(true);
    expect(matchesAnyToken(tokens, ["Floyd"])).toBe(true);
  });

  it("does not match when no token is found", () => {
    const tokens = tokenizeQuery("Zeppelin");
    expect(matchesAnyToken(tokens, ["Pink Floyd"])).toBe(false);
  });

  it("handles diacritics", () => {
    const tokens = tokenizeQuery("Bjork");
    expect(matchesAnyToken(tokens, ["Björk"])).toBe(true);
  });

  it("ignores null/undefined targets", () => {
    const tokens = tokenizeQuery("test");
    expect(matchesAnyToken(tokens, [null, undefined, "test"])).toBe(true);
  });
});

describe("matchesAllTokens", () => {
  it("matches when all tokens are found across targets", () => {
    const tokens = tokenizeQuery("Pink Floyd");
    expect(matchesAllTokens(tokens, ["Pink Floyd"])).toBe(true);
    expect(matchesAllTokens(tokens, ["Pink", "Floyd"])).toBe(true);
  });

  it("does not match when some tokens are missing", () => {
    const tokens = tokenizeQuery("Pink Floyd");
    expect(matchesAllTokens(tokens, ["Pink"])).toBe(false);
    expect(matchesAllTokens(tokens, ["Floyd"])).toBe(false);
  });

  it("returns false for empty tokens", () => {
    expect(matchesAllTokens([], ["anything"])).toBe(false);
  });

  it("handles diacritics across tokens and targets", () => {
    const tokens = tokenizeQuery("Dvorak Requiem");
    expect(matchesAllTokens(tokens, ["Dvořák", "Requiem in D minor"])).toBe(
      true,
    );
  });

  it("matches partial tokens", () => {
    const tokens = tokenizeQuery("Pin Flo");
    expect(matchesAllTokens(tokens, ["Pink Floyd"])).toBe(true);
  });
});
