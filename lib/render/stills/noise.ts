import seedrandom from "seedrandom";

export function seededNoise(seed: string) {
  const rng = seedrandom(seed);
  return () => rng(); // 0..1
}

export function noisePoints(seed: string, count: number, w: number, h: number) {
  const rnd = seededNoise(seed);
  const pts: Array<{ x: number; y: number; r: number; a: number }> = [];
  for (let i = 0; i < count; i++) {
    pts.push({
      x: Math.floor(rnd() * w),
      y: Math.floor(rnd() * h),
      r: 0.5 + rnd() * 1.8,
      a: 0.04 + rnd() * 0.10,
    });
  }
  return pts;
}
