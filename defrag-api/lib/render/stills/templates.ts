import type { RenderInputs } from "./types";
import { noisePoints } from "./noise";

function clamp10(n: number) {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.floor(n / 10) * 10;
}

// Intensity only uses deterministic buckets, not hidden engine math.
function intensityFrom(inputs: RenderInputs): number {
  const p = inputs.pressureBucket === "HIGH" ? 1 : inputs.pressureBucket === "MED" ? 0.6 : 0.3;
  const f = clamp10(inputs.frictionBracket10) / 100;
  return Math.min(1, 0.35 * p + 0.65 * f);
}

export function makeStillSvg(inputs: RenderInputs, w = 1080, h = 1350): string {
  const intensity = intensityFrom(inputs);

  // Deterministic grain layer
  const pts = noisePoints(inputs.hash, 1200, w, h)
    .map(p => `<circle cx="${p.x}" cy="${p.y}" r="${p.r.toFixed(2)}" fill="white" opacity="${p.a.toFixed(3)}"/>`)
    .join("");

  // Minimal glyph grammar
  const boundaryOpacity = (0.10 + 0.30 * (1 - intensity)).toFixed(3);
  const systemStroke = (0.16 + 0.30 * intensity).toFixed(3);

  const leftScale = (0.86 + 0.10 * intensity).toFixed(3);
  const rightScale = (0.86 + 0.10 * (1 - intensity)).toFixed(3);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#000000"/>

  <!-- grain -->
  <g>${pts}</g>

  <!-- boundary -->
  <line x1="${Math.floor(w * 0.50)}" y1="${Math.floor(h * 0.10)}"
        x2="${Math.floor(w * 0.50)}" y2="${Math.floor(h * 0.90)}"
        stroke="#FFFFFF" stroke-opacity="${boundaryOpacity}" stroke-width="2"/>

  <!-- left system -->
  <g transform="translate(${Math.floor(w * 0.25)} ${Math.floor(h * 0.52)}) scale(${leftScale})">
    <circle cx="0" cy="0" r="${Math.floor(Math.min(w, h) * 0.16)}"
            fill="none" stroke="#FFFFFF" stroke-opacity="${systemStroke}" stroke-width="3"/>
    <circle cx="0" cy="0" r="${Math.floor(Math.min(w, h) * 0.05)}"
            fill="#FFFFFF" opacity="${(0.08 + 0.25 * intensity).toFixed(3)}"/>
  </g>

  <!-- right system -->
  <g transform="translate(${Math.floor(w * 0.75)} ${Math.floor(h * 0.52)}) scale(${rightScale})">
    <rect x="${-Math.floor(Math.min(w, h) * 0.11)}" y="${-Math.floor(Math.min(w, h) * 0.11)}"
          width="${Math.floor(Math.min(w, h) * 0.22)}" height="${Math.floor(Math.min(w, h) * 0.22)}"
          fill="none" stroke="#FFFFFF" stroke-opacity="${systemStroke}" stroke-width="3"/>
    <rect x="${-Math.floor(Math.min(w, h) * 0.03)}" y="${-Math.floor(Math.min(w, h) * 0.03)}"
          width="${Math.floor(Math.min(w, h) * 0.06)}" height="${Math.floor(Math.min(w, h) * 0.06)}"
          fill="#FFFFFF" opacity="${(0.08 + 0.25 * (1 - intensity)).toFixed(3)}"/>
  </g>

  <!-- micro labels -->
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="18" fill="#FFFFFF" fill-opacity="0.45" letter-spacing="6">
    <text x="80" y="110">FRAG</text>
    <text x="80" y="150">${inputs.assetVersion.toUpperCase()}</text>
  </g>
</svg>`;
}
