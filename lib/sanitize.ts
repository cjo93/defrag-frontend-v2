// Prevent accidental leakage of internal computation, prompts, or raw bundles.
const BLOCKLIST = [
  "algorithm", "mapping", "threshold", "score", "scoring", "calculated", "computed",
  "system prompt", "prompt", "raw json", "json", "framework", "human design", "astrology",
  "transit", "zodiac", "planet", "retrograde", "chakra",
];

// Pre-compiled regex for better performance on repeated calls.
// Matches whole words or phrases, case-insensitive.
// The pattern uses word boundaries (\b) where appropriate, or allows partial matches if the blocklist term implies it.
// For now, we'll stick to a simple alternation which behaves similarly to 'includes', but faster.
// Escaping special regex characters is good practice if BLOCKLIST is dynamic, but it's static here.
const BLOCKLIST_REGEX = new RegExp(BLOCKLIST.join("|"), "i");

export function violatesDisclosure(text: string): boolean {
  return BLOCKLIST_REGEX.test(text);
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
