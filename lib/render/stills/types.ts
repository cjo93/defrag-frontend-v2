export type FidelityBucket = "HIGH" | "MEDIUM" | "LOW";
export type PressureBucket = "LOW" | "MED" | "HIGH";

export interface RenderInputs {
  hash: string;                 // opaque cache key
  userClass: string;            // e.g. "KINETIC_MOTOR"
  targetClass: string;
  pressureBucket: PressureBucket;
  fidelityBucket: FidelityBucket;
  frictionBracket10: number;    // 0..100 step 10
  assetVersion: string;         // e.g. "v1_stills"
}

export interface RenderResult {
  png: Buffer; // Changed from Uint8Array to Buffer for Resvg consistency
  width: number;
  height: number;
  bytes?: number;
  sha256?: string;
}
