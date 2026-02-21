export type SafetyTier = "GREEN" | "YELLOW" | "RED";

export function computeTier(message: string): SafetyTier {
  const t = message.toLowerCase();

  // RED: imminent harm / self-harm / violence cues (broad, conservative)
  const red = ["kill myself", "suicide", "hurt myself", "end it", "kill them", "hurt them", "weapon", "gun", "knife"];
  if (red.some((k) => t.includes(k))) return "RED";

  // YELLOW: high escalation language
  const yellow = ["panic", "can't breathe", "screaming", "fight right now", "losing it", "threatening", "unsafe"];
  if (yellow.some((k) => t.includes(k))) return "YELLOW";

  return "GREEN";
}
