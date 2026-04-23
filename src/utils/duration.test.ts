import { describe, expect, it } from "vitest";
import { clampProgress, isValidDuration } from "./duration";

describe("isValidDuration", () => {
  it("returns true for positive finite numbers", () => {
    expect(isValidDuration(1)).toBe(true);
    expect(isValidDuration(100.5)).toBe(true);
  });

  it("returns false for zero", () => {
    expect(isValidDuration(0)).toBe(false);
  });

  it("returns false for negative numbers", () => {
    expect(isValidDuration(-1)).toBe(false);
  });

  it("returns false for Infinity", () => {
    expect(isValidDuration(Infinity)).toBe(false);
    expect(isValidDuration(-Infinity)).toBe(false);
  });

  it("returns false for NaN", () => {
    expect(isValidDuration(NaN)).toBe(false);
  });

  it("returns false for non-numbers", () => {
    expect(isValidDuration("10" as unknown)).toBe(false);
    expect(isValidDuration(null as unknown)).toBe(false);
    expect(isValidDuration(undefined as unknown)).toBe(false);
  });

  it("acts as a type guard", () => {
    const val: unknown = 42;
    if (isValidDuration(val)) {
      expect(typeof val).toBe("number");
    }
  });
});

describe("clampProgress", () => {
  it("returns 0 when duration is invalid", () => {
    expect(clampProgress(5, 0)).toBe(0);
    expect(clampProgress(5, -1)).toBe(0);
    expect(clampProgress(5, NaN)).toBe(0);
  });

  it("returns 0 when progress is negative", () => {
    expect(clampProgress(-5, 100)).toBe(0);
  });

  it("clamps progress to duration when exceeding", () => {
    expect(clampProgress(150, 100)).toBe(100);
  });

  it("returns progress when within bounds", () => {
    expect(clampProgress(50, 100)).toBe(50);
  });

  it("handles progress equal to duration", () => {
    expect(clampProgress(100, 100)).toBe(100);
  });

  it("handles progress of 0", () => {
    expect(clampProgress(0, 100)).toBe(0);
  });
});