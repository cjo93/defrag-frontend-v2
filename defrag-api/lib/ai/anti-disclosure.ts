// defrag-api/lib/ai/anti-disclosure.ts

// Blocklist of forbidden tokens that reveal engine mechanics or "theatre".
const FORBIDDEN_TOKENS = [
  "algorithm", "formula", "computed", "calculated", "weights", "thresholds", "mapping",
  "nasa", "horizons", "jpl", "ephemeris", "longitude", "degrees", "aspect",
  "astrology", "human design", "chakra", "vibration", "frequency", "quantum",
  "gate 22", "channel", "transit", "retrograde", "shadow", "manifestation",
  "openai", "gpt", "model", "prompt", "json"
];

export function validateFragText(text: string): boolean {
  const lower = text.toLowerCase();
  // Check for forbidden tokens
  for (const token of FORBIDDEN_TOKENS) {
    if (lower.includes(token)) return false;
  }
  // Check for raw numbers (decimals or large integers might indicate raw data leakage)
  // Allow simple small integers (e.g. "Step 1", "2 options") but block precision
  if (/\d+\.\d+/.test(lower)) return false; // No decimals

  return true;
}

export function getFallbackText(args: {
  pressureBucket: "LOW" | "MED" | "HIGH";
  frictionBucket10: number; // 0..100
  fidelity: "HIGH" | "MEDIUM" | "LOW";
}): { state: string; action: string } {
  const { pressureBucket, frictionBucket10 } = args;

  // Deterministic Templates (Kindergarten Level)
  // Low Pressure
  if (pressureBucket === "LOW") {
    if (frictionBucket10 <= 30) {
      return {
        state: "The field is clear.",
        action: "Move forward with your plan.",
      };
    }
    return {
      state: "Minor resistance detected.",
      action: "Check your pacing before speaking.",
    };
  }

  // Medium Pressure
  if (pressureBucket === "MED") {
    if (frictionBucket10 <= 50) {
      return {
        state: "Load is increasing.",
        action: "Simplification is required.",
      };
    }
    return {
      state: "Friction is active.",
      action: "Wait for a clearer signal.",
    };
  }

  // High Pressure
  if (frictionBucket10 <= 40) {
    return {
      state: "High gravity environment.",
      action: "Reduce speed and observe.",
    };
  }

  return {
    state: "System locked.",
    action: "Do not force an outcome today.",
  };
}
