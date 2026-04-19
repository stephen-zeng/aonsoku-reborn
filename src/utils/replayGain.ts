import type { ISong } from "@/types/responses/song";

export interface ReplayGainParams {
  gain: number;
  peak: number;
  preAmp: number;
}

// https://wiki.hydrogenaud.io/index.php?title=ReplayGain_1.0_specification&section=19
export function calculateReplayGain({ gain, peak, preAmp }: ReplayGainParams) {
  const baseGain = Math.pow(10, (gain + preAmp) / 20);

  return Math.min(baseGain, 1 / peak);
}

export function resolveReplayGainParams(
  songReplayGain: ISong["replayGain"],
  type: ReplayGainType,
  preAmp: number,
  defaultGain: number,
): ReplayGainParams {
  if (!songReplayGain) {
    return { gain: defaultGain, peak: 1, preAmp };
  }

  if (type === "album") {
    const { albumGain = defaultGain, albumPeak = 1 } = songReplayGain;
    return { gain: albumGain, peak: albumPeak, preAmp };
  }

  const { trackGain = defaultGain, trackPeak = 1 } = songReplayGain;
  return { gain: trackGain, peak: trackPeak, preAmp };
}
