import { Resvg } from "@resvg/resvg-js";
import crypto from "node:crypto";
import { buildNoiseSvg } from "./noise";
import { buildStillSvg, parseHashForStillSpec } from "./templates";

export interface RenderedStill {
  png: Buffer;
  width: number;
  height: number;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function renderStillFromHash(assetHash: string): RenderedStill {
  const spec = parseHashForStillSpec(assetHash);
  const seed = sha256(`${assetHash}:${spec.assetVersion}`);

  const width = 1080;
  const height = 1350;

  const baseSvg = buildStillSvg(spec, seed);
  const noiseSvg = buildNoiseSvg(width, height, seed, spec.fidelity === "LOW" ? 0.10 : 0.06);

  // Composite by simple concatenation: render base first, then noise.
  // (Resvg renders one SVG; so we wrap both as nested <image> via data URIs)
  const toDataUri = (svg: string) =>
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  const composite = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <image href="${toDataUri(baseSvg)}" width="${width}" height="${height}" />
  <image href="${toDataUri(noiseSvg)}" width="${width}" height="${height}" opacity="1" />
</svg>`;

  const resvg = new Resvg(composite, {
    fitTo: { mode: "original" },
    background: "black",
  });

  const out = resvg.render();
  return { png: Buffer.from(out.asPng()), width, height };
}
