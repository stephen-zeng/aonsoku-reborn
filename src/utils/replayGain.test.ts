import { describe, expect, it } from "vitest";
import { calculateReplayGain, resolveReplayGainParams } from "./replayGain";

describe("calculateReplayGain", () => {
  it("returns 1 for 0 dB gain and peak 1 and 0 preAmp", () => {
    expect(calculateReplayGain({ gain: 0, peak: 1, preAmp: 0 })).toBeCloseTo(
      1,
      10,
    );
  });

  it("applies positive gain correctly", () => {
    const result = calculateReplayGain({ gain: 6, peak: 1, preAmp: 0 });
    expect(result).toBe(1);
  });

  it("applies negative gain correctly", () => {
    const result = calculateReplayGain({ gain: -6, peak: 1, preAmp: 0 });
    expect(result).toBeLessThan(1);
    expect(result).toBeCloseTo(0.501, 3);
  });

  it("allows gain > 1 when peak allows it", () => {
    const result = calculateReplayGain({ gain: 6, peak: 0.5, preAmp: 0 });
    expect(result).toBeCloseTo(2, 2);
  });

  it("clamps to 1/peak when peak limiting", () => {
    const result = calculateReplayGain({ gain: 20, peak: 0.5, preAmp: 0 });
    expect(result).toBe(2);
  });

  it("applies preAmp", () => {
    const result = calculateReplayGain({ gain: 0, peak: 1, preAmp: 6 });
    expect(result).toBe(1);
  });

  it("applies preAmp when peak allows higher gain", () => {
    const result = calculateReplayGain({ gain: -6, peak: 1, preAmp: 6 });
    expect(result).toBe(1);
  });
});

describe("resolveReplayGainParams", () => {
  it("returns defaults when song has no replayGain", () => {
    const result = resolveReplayGainParams(null, "track", 0, -6);
    expect(result).toEqual({ gain: -6, peak: 1, preAmp: 0 });
  });

  it("returns defaults when song has undefined replayGain", () => {
    const result = resolveReplayGainParams(undefined, "track", 0, -6);
    expect(result).toEqual({ gain: -6, peak: 1, preAmp: 0 });
  });

  it("resolves track gain", () => {
    const songReplayGain = {
      trackGain: -4,
      trackPeak: 0.9,
      albumGain: -8,
      albumPeak: 0.7,
    };
    const result = resolveReplayGainParams(songReplayGain, "track", 3, -6);
    expect(result).toEqual({ gain: -4, peak: 0.9, preAmp: 3 });
  });

  it("resolves album gain", () => {
    const songReplayGain = {
      trackGain: -4,
      trackPeak: 0.9,
      albumGain: -8,
      albumPeak: 0.7,
    };
    const result = resolveReplayGainParams(songReplayGain, "album", 3, -6);
    expect(result).toEqual({ gain: -8, peak: 0.7, preAmp: 3 });
  });

  it("uses defaultGain when trackGain is undefined", () => {
    const songReplayGain = {
      trackGain: undefined as unknown as number,
      trackPeak: undefined as unknown as number,
      albumGain: -8,
      albumPeak: 0.7,
    };
    const result = resolveReplayGainParams(songReplayGain, "track", 0, -10);
    expect(result).toEqual({ gain: -10, peak: 1, preAmp: 0 });
  });
});
