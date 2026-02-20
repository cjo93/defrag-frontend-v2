export type PressureBucket = "LOW" | "MED" | "HIGH";
export type FidelityBucket = "HIGH" | "MEDIUM" | "LOW";

export type ClassTag =
  | "KINETIC_MOTOR"
  | "HYBRID_TURBINE"
  | "OPTICAL_SCANNER"
  | "INITIATION_THRUSTER"
  | "AMBIENT_MIRROR"
  | "NEBULA_VARIABLE";

export interface StillSpec {
  userClass: ClassTag;
  targetClass: ClassTag;
  pressure: PressureBucket;
  fidelity: FidelityBucket;
  assetVersion: "v1_stills";
}

export function parseHashForStillSpec(hash: string): StillSpec {
  // IMPORTANT: hash is opaque. We only need deterministic mapping.
  // If your hash format already encodes tags, parse it here.
  // Otherwise: use stable derivation from hash chars.
  const h = hash.toLowerCase();

  const pick = <T extends string>(arr: readonly T[], idx: number): T =>
    arr[idx % arr.length];

  const classes = [
    "KINETIC_MOTOR",
    "HYBRID_TURBINE",
    "OPTICAL_SCANNER",
    "INITIATION_THRUSTER",
    "AMBIENT_MIRROR",
    "NEBULA_VARIABLE",
  ] as const;

  const pressures = ["LOW", "MED", "HIGH"] as const;
  const fidelities = ["HIGH", "MEDIUM", "LOW"] as const;

  const n1 = parseInt(h.slice(0, 2), 16) || 0;
  const n2 = parseInt(h.slice(2, 4), 16) || 0;
  const n3 = parseInt(h.slice(4, 6), 16) || 0;
  const n4 = parseInt(h.slice(6, 8), 16) || 0;

  return {
    userClass: pick(classes, n1),
    targetClass: pick(classes, n2),
    pressure: pick(pressures, n3),
    fidelity: pick(fidelities, n4),
    assetVersion: "v1_stills",
  };
}

export function buildStillSvg(spec: StillSpec, seed: string): string {
  // Pure black background, pure white geometry, subtle uncertainty for LOW fidelity.
  // No gradients in background. No “rainbow”. No animation.
  const w = 1080;
  const h = 1350;

  const opacityByPressure: Record<PressureBucket, number> = {
    LOW: 0.20,
    MED: 0.35,
    HIGH: 0.55,
  };

  const blurByFidelity: Record<FidelityBucket, number> = {
    HIGH: 0.0,
    MEDIUM: 0.8,
    LOW: 2.2,
  };

  const coreOpacity = opacityByPressure[spec.pressure];
  const blur = blurByFidelity[spec.fidelity];

  // Minimal “instrument” composition: left system + right system + boundary line.
  // Deterministic “noise” is handled later via a seeded overlay layer.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${blur}" />
    </filter>
  </defs>

  <rect x="0" y="0" width="${w}" height="${h}" fill="#000000"/>

  <!-- Boundary line -->
  <line x1="${w * 0.12}" y1="${h * 0.62}" x2="${w * 0.88}" y2="${h * 0.62}"
    stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="2"/>

  <!-- User system (left) -->
  <g filter="url(#soft)">
    <circle cx="${w * 0.30}" cy="${h * 0.45}" r="${h * 0.16}"
      fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="3"/>
    <circle cx="${w * 0.30}" cy="${h * 0.45}" r="${h * 0.09}"
      fill="#FFFFFF" fill-opacity="${coreOpacity}"/>
  </g>

  <!-- Target system (right) -->
  <g filter="url(#soft)">
    <rect x="${w * 0.58}" y="${h * 0.30}" width="${w * 0.24}" height="${h * 0.30}"
      fill="none" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="3"/>
    <rect x="${w * 0.64}" y="${h * 0.40}" width="${w * 0.12}" height="${h * 0.10}"
      fill="#FFFFFF" fill-opacity="${coreOpacity}"/>
  </g>

  <!-- Micro label -->
  <text x="${w * 0.12}" y="${h * 0.86}" fill="#FFFFFF" fill-opacity="0.40"
    font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    font-size="22" letter-spacing="0.35em">
    FRAG / ${spec.assetVersion.toUpperCase()}
  </text>

  <text x="${w * 0.12}" y="${h * 0.90}" fill="#FFFFFF" fill-opacity="0.28"
    font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    font-size="18" letter-spacing="0.22em">
    HASH / ${seed.slice(0, 12).toUpperCase()}
  </text>
</svg>`;
}
