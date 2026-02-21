import crypto from "crypto";

export type HorizonsParams = {
  startUtc: string; // YYYY-MM-DD
  stopUtc: string;  // YYYY-MM-DD
  step: string;     // e.g. "60m"
};

// V1 locked bodies: Sun, Moon, Mercury, Mars, Saturn
// NO extra bodies (no Venus, Jupiter, Uranus, Neptune, Pluto)
const BODIES = [
  "10",  // Sun
  "301", // Moon
  "199", // Mercury
  "499", // Mars
  "699", // Saturn
];

export async function fetchHorizonsEphemeris(params: HorizonsParams) {
  const url = "https://ssd.jpl.nasa.gov/api/horizons.api";

  // COMMAND: Use center 500@399 (Geocentric)
  // QUANTITIES: 31 (Observer Ecliptic Lon/Lat)

  const results: Record<string, { date: string; lon: number; lat: number }[]> = {};
  let combinedRaw = "";

  for (const body of BODIES) {
    const query = new URLSearchParams({
      format: "text",
      COMMAND: `'${body}'`,
      OBJ_DATA: "'YES'",
      MAKE_EPHEM: "'YES'",
      EPHEM_TYPE: "'OBSERVER'",
      CENTER: "'500@399'",
      START_TIME: `'${params.startUtc}'`,
      STOP_TIME: `'${params.stopUtc}'`,
      STEP_SIZE: `'${params.step}'`,
      QUANTITIES: "'31'",
      CSV_FORMAT: "'YES'",
    });

    const res = await fetch(`${url}?${query.toString()}`);
    if (!res.ok) throw new Error(`Horizons API HTTP ${res.status} for body ${body}`);

    const text = await res.text();
    // Verify valid response
    if (!text.includes("$$SOE")) throw new Error(`Horizons API invalid response for body ${body}`);

    results[body] = parseHorizonsResponse(text);
    combinedRaw += `--BODY ${body}--\n${text}\n`;
  }

  const rawHash = crypto.createHash("sha256").update(combinedRaw).digest("hex");

  return {
    rawText: combinedRaw,
    rawHash,
    parsed: results,
  };
}

function parseHorizonsResponse(text: string) {
  const startMarker = "$$SOE";
  const endMarker = "$$EOE";
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) return [];

  const dataBlock = text.slice(startIdx + startMarker.length, endIdx).trim();
  if (!dataBlock) return [];

  return dataBlock.split("\n").map(line => {
    // Horizons CSV format (Quantities 31):
    // Date__(UT)__HR:MN, ObsEcLon, ObsEcLat
    const parts = line.split(",").map(p => p.trim());
    if (parts.length < 3) return null;

    // Ecliptic Longitude is typically the 2nd column in Quantities 31 CSV output
    // But format can be quirky.
    // Example: 2026-Jan-28 00:00, 308.12345, -0.12345
    // index 0 is Date, 1 is Lon, 2 is Lat.
    const lon = parseFloat(parts[1]);
    const lat = parseFloat(parts[2]);

    if (isNaN(lon) || isNaN(lat)) return null;

    return {
      date: parts[0],
      lon,
      lat,
    };
  }).filter((x): x is { date: string; lon: number; lat: number } => x !== null);
}
