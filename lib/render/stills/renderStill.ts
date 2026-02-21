import { Resvg } from "@resvg/resvg-js";
import type { RenderInputs, RenderResult } from "./types";
import { makeStillSvg } from "./templates";

export async function renderStill(inputs: RenderInputs): Promise<RenderResult> {
  const width = 1080;
  const height = 1350;

  const svg = makeStillSvg(inputs, width, height);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: {
      loadSystemFonts: false,
    },
  });

  const rendered = resvg.render();
  const png = rendered.asPng();

  return {
    png,
    width,
    height,
  };
}
