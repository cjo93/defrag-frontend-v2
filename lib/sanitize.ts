// Prevent accidental leakage of internal computation, prompts, or raw bundles.
const BLOCKLIST = [
  "algorithm", "mapping", "threshold", "score", "scoring", "calculated", "computed",
  "system prompt", "prompt", "raw json", "json", "framework", "human design", "astrology",
  "transit", "zodiac", "planet", "retrograde", "chakra",
];

export function violatesDisclosure(text: string): boolean {
  const t = text.toLowerCase();
  return BLOCKLIST.some((w) => t.includes(w));
}

export function safeFallback() {
  return {
    headline: "Pause and reset",
    happening: "Not enough data to be specific.",
    doThis:
      "Put both feet on the floor. Inhale through your nose for 4. Exhale for 6. Repeat 6 times. Then drink water. Then choose one action: step away for 10 minutes, or ask for a time to talk.",
    avoid: "Do not argue while your body is activated.",
    sayThis: "\"I want to handle this well. I need ten minutes, then I’ll come back.\"",
  };
}
