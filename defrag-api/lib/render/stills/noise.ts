import seedrandom from "seedrandom";

// Deterministic monochrome noise overlay (subtle). No gradients in background.
// Returns an SVG layer string to be composited before rasterization.
export function buildNoiseSvg(width: number, height: number, seed: string, intensity = 0.06): string {
  const rng = seedrandom(seed);
  const dots = 1400; // keep light for perf

  let circles = "";
  for (let i = 0; i < dots; i++) {
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    const r = 0.6 + rng() * 1.3;
    const a = (rng() * intensity).toFixed(4);
    circles += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="#FFFFFF" fill-opacity="${a}" />`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  ${circles}
</svg>`;
}
