export function perceptualToGain(volume: number): number {
  return (volume / 100) ** 3.3;
}
