import { describe, expect, it } from "vitest";
import { byteLength } from "./byteLength";

describe("byteLength", () => {
  it("returns 0 for empty string", () => {
    expect(byteLength("")).toBe(0);
  });

  it("counts ASCII characters as 1 byte each", () => {
    expect(byteLength("abc")).toBe(3);
  });

  it("counts 2-byte characters correctly (0x80-0x7FF range)", () => {
    expect(byteLength("\u00E9")).toBe(2);
  });

  it("counts 3-byte characters correctly (0x800-0xFFFF range)", () => {
    expect(byteLength("\u4E16")).toBe(3);
  });

  it("handles surrogate pairs (emoji)", () => {
    expect(byteLength("\uD83D\uDE00")).toBe(4);
  });

  it("mixed ASCII and multi-byte", () => {
    const str = "a\u00E9\u4E16";
    expect(byteLength(str)).toBe(1 + 2 + 3);
  });
});