import { describe, expect, it } from "vitest";
import {
  blendColors,
  hexToRgb,
  hexToRgba,
  hslToHex,
  hslToHsla,
  hslToRgb,
  isDarkColor,
} from "./getAverageColor";

describe("hslToRgb", () => {
  it("converts pure red (0 100% 50%)", () => {
    const [r, g, b] = hslToRgb("0 100% 50%");
    expect(r).toBeCloseTo(255, 0);
    expect(g).toBeCloseTo(0, 0);
    expect(b).toBeCloseTo(0, 0);
  });

  it("converts pure green (120 100% 50%)", () => {
    const [r, g, b] = hslToRgb("120 100% 50%");
    expect(r).toBeCloseTo(0, 0);
    expect(g).toBeCloseTo(255, 0);
    expect(b).toBeCloseTo(0, 0);
  });

  it("converts pure blue (240 100% 50%)", () => {
    const [r, g, b] = hslToRgb("240 100% 50%");
    expect(r).toBeCloseTo(0, 0);
    expect(g).toBeCloseTo(0, 0);
    expect(b).toBeCloseTo(255, 0);
  });

  it("converts black (0 0% 0%)", () => {
    const [r, g, b] = hslToRgb("0 0% 0%");
    expect(r).toBeCloseTo(0, 0);
    expect(g).toBeCloseTo(0, 0);
    expect(b).toBeCloseTo(0, 0);
  });

  it("converts white (0 0% 100%)", () => {
    const [r, g, b] = hslToRgb("0 0% 100%");
    expect(r).toBeCloseTo(255, 0);
    expect(g).toBeCloseTo(255, 0);
    expect(b).toBeCloseTo(255, 0);
  });

  it("converts yellow (60 100% 50%)", () => {
    const [r, g, b] = hslToRgb("60 100% 50%");
    expect(r).toBeCloseTo(255, 0);
    expect(g).toBeCloseTo(255, 0);
    expect(b).toBeCloseTo(0, 0);
  });

  it("converts a dark color (240 10% 3.9%)", () => {
    const [r, g, b] = hslToRgb("240 10% 3.9%");
    expect(r).toBeGreaterThan(-1);
    expect(g).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(-1);
  });

  it("produces the same result for the same input", () => {
    const a = hslToRgb("240 10% 3.9%");
    const b = hslToRgb("240 10% 3.9%");
    expect(a).toEqual(b);
  });
});

describe("hslToHex", () => {
  it("converts pure red to hex", () => {
    const hex = hslToHex("0 100% 50%");
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("converts black to #000000", () => {
    const hex = hslToHex("0 0% 0%");
    expect(hex).toBe("#000000");
  });

  it("converts white to #ffffff", () => {
    const hex = hslToHex("0 0% 100%");
    expect(hex).toBe("#ffffff");
  });
});

describe("isDarkColor", () => {
  it("returns true for black", () => {
    expect(isDarkColor("0 0% 0%")).toBe(true);
  });

  it("returns false for white", () => {
    expect(isDarkColor("0 0% 100%")).toBe(false);
  });

  it("returns true for a very dark color", () => {
    expect(isDarkColor("240 10% 3.9%")).toBe(true);
  });

  it("returns false for a bright color", () => {
    expect(isDarkColor("0 100% 80%")).toBe(false);
  });
});

describe("hslToHsla", () => {
  it("converts HSL string to HSLA with default alpha 1", () => {
    const result = hslToHsla("240 10% 3.9%");
    expect(result).toBe("hsla(240, 10%, 3.9%, 1)");
  });

  it("converts HSL string with custom alpha", () => {
    const result = hslToHsla("0 100% 50%", 0.5);
    expect(result).toBe("hsla(0, 100%, 50%, 0.5)");
  });
});

describe("hexToRgb", () => {
  it("converts 6-digit hex", () => {
    expect(hexToRgb("#ff0000")).toEqual([255, 0, 0]);
  });

  it("converts 3-digit hex", () => {
    expect(hexToRgb("#f00")).toEqual([255, 0, 0]);
  });

  it("converts hex without # prefix", () => {
    expect(hexToRgb("00ff00")).toEqual([0, 255, 0]);
  });

  it("returns undefined for invalid hex length", () => {
    expect(hexToRgb("#ff")).toBeUndefined();
  });
});

describe("hexToRgba", () => {
  it("converts hex to rgba with default alpha", () => {
    expect(hexToRgba("#ff0000")).toBe("rgba(255, 0, 0, 1)");
  });

  it("converts hex to rgba with custom alpha", () => {
    expect(hexToRgba("#000000", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("returns undefined for invalid hex", () => {
    expect(hexToRgba("invalid")).toBeUndefined();
  });
});

describe("blendColors", () => {
  it("blends two hex colors with given alpha", () => {
    const result = blendColors("#000000", "#ffffff", 0.5);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns base color unchanged with alpha 0", () => {
    expect(blendColors("#ff0000", "#0000ff", 0)).toBe("#ff0000");
  });

  it("returns overlay color with alpha 1", () => {
    expect(blendColors("#000000", "#0000ff", 1)).toBe("#0000ff");
  });

  it("returns base color when overlay is invalid", () => {
    expect(blendColors("#ff0000", "invalid", 0.5)).toBe("#ff0000");
  });
});
