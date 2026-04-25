import { describe, expect, it } from "vitest";
import { perceptualToGain } from "./volume";

describe("perceptualToGain", () => {
  it("returns 0 for volume 0", () => {
    expect(perceptualToGain(0)).toBe(0);
  });

  it("returns 1 for volume 100", () => {
    expect(perceptualToGain(100)).toBeCloseTo(1, 10);
  });

  it("returns a value between 0 and 1 for volume 50", () => {
    const result = perceptualToGain(50);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it("applies the 3.3 exponent for perceptual scaling", () => {
    const result = perceptualToGain(50);
    expect(result).toBeCloseTo(0.5 ** 3.3, 10);
  });

  it("increases monotonically", () => {
    expect(perceptualToGain(25)).toBeLessThan(perceptualToGain(50));
    expect(perceptualToGain(50)).toBeLessThan(perceptualToGain(75));
  });
});
