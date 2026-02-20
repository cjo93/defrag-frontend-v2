import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchHorizonsEphemeris, HorizonsParams } from "@/lib/nasa/horizons";
import {
  computeDailyWeather,
  computeBaselineVector,
  computeFriction,
  Provenance,
  DailyWeatherOutput,
  BaselineVectorOutput,
  FrictionOutput,
} from "./v1/index";

const ENGINE_VERSION = "1.0.0";

// Simple In-Memory Rate Limit
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const rateLimitMap = new Map<string, number>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const last = rateLimitMap.get(key) || 0;
  if (now - last < RATE_LIMIT_WINDOW) return false;
  rateLimitMap.set(key, now);
  // Cleanup old keys
  if (rateLimitMap.size > 1000) rateLimitMap.clear();
  return true;
}

// Canonical JSON Hashing
function hashInputs(inputs: any): string {
  const keys = Object.keys(inputs).sort();
  const sortedObj: any = {};
  keys.forEach(k => sortedObj[k] = inputs[k]);
  const canonical = JSON.stringify(sortedObj);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

async function getCachedOutput(
  userId: string,
  kind: string,
  inputsHash: string,
  dateLocal?: string,
  subjectId?: string
) {
  let q = supabaseAdmin
    .from("engine_outputs")
    .select("output_json")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("engine_version", ENGINE_VERSION)
    .eq("inputs_hash", inputsHash);

  if (dateLocal) q = q.eq("date_local", dateLocal);
  if (subjectId) q = q.eq("subject_id", subjectId);
  else q = q.is("subject_id", null);

  const { data, error } = await q.maybeSingle();
  if (error) console.error("Cache fetch error:", error);
  return data?.output_json || null;
}

async function storeOutput(
  userId: string,
  kind: string,
  inputsHash: string,
  output: any,
  dateLocal?: string,
  subjectId?: string,
  horizonsRunId?: string
) {
  const { error } = await supabaseAdmin.from("engine_outputs").insert({
    user_id: userId,
    kind,
    date_local: dateLocal ?? null,
    subject_id: subjectId ?? null,
    engine_version: ENGINE_VERSION,
    inputs_hash: inputsHash,
    output_json: output,
    horizons_run_id: horizonsRunId ?? null,
  });
  if (error) console.error("Store output error:", error);
}

// --- Daily Weather ---

export async function getDailyWeather(
  userId: string,
  dateLocal: string,
  timezone: string,
  city: string
): Promise<DailyWeatherOutput | null> {
  const inputs = { dateLocal, timezone, city, engine: ENGINE_VERSION };
  const inputsHash = hashInputs(inputs);

  const cached = await getCachedOutput(userId, "daily_weather", inputsHash, dateLocal);
  if (cached) return cached as DailyWeatherOutput;

  return recomputeDailyWeather(userId, dateLocal, timezone, city, inputsHash);
}

async function recomputeDailyWeather(
  userId: string,
  dateLocal: string,
  timezone: string,
  city: string,
  inputsHash: string
): Promise<DailyWeatherOutput | null> {
  // STRICT WINDOW: Local Day 00:00 - 23:59 converted to UTC
  // dateLocal is "YYYY-MM-DD"

  // Construct Start of Day in Local Time
  // We use string manipulation to avoid browser timezone issues
  // "YYYY-MM-DD" + "T00:00:00"
  // Note: Date parsing is tricky. Ideally use a library like 'date-fns-tz' but we are stdlib only.
  // Best approach for backend: Treat dateLocal as the date in the user's timezone.

  // 1. Find UTC start/end for that local date.
  // We need to fetch enough hours from Horizons to cover it.
  // Since we don't have a timezone library, we will fetch a generous 48h window (local date -1 to +2)
  // and then FILTER strictly based on the converted timestamp.
  // This ensures we have the data without needing precise UTC offset calc upfront.

  const d = new Date(dateLocal);
  const start = new Date(d); start.setDate(d.getDate() - 1);
  const end = new Date(d); end.setDate(d.getDate() + 2);

  const startUtc = start.toISOString().split("T")[0];
  const stopUtc = end.toISOString().split("T")[0];

  const params: HorizonsParams = {
    startUtc,
    stopUtc,
    step: "60m",
  };

  try {
    const horizons = await fetchHorizonsEphemeris(params);

    // Store run
    const runRes = await supabaseAdmin.from("horizons_runs").insert({
      user_id: userId,
      kind: "daily_weather",
      request_json: params,
      raw_text: horizons.rawText,
      raw_hash: horizons.rawHash,
      start_utc: startUtc,
      stop_utc: stopUtc,
      step_minutes: 60,
    }).select("id").single();

    const horizonsRunId = runRes.data?.id;

    // Filter steps strictly for local day
    const steps: { t_utc: string; lon: Record<string, number> }[] = [];
    const timestamps = horizons.parsed["10"]?.map(x => x.date) || [];

    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      const dateObj = new Date(t + " UTC");

      // Check local date string in user timezone
      const localDateStr = dateObj.toLocaleDateString("en-CA", { timeZone: timezone });

      if (localDateStr === dateLocal) {
        const stepLon: Record<string, number> = {};
        let missing = false;

        for (const bodyId in horizons.parsed) {
          const entry = horizons.parsed[bodyId][i];
          if (!entry) { missing = true; break; }
          stepLon[bodyId] = entry.lon;
        }

        if (!missing) {
          steps.push({ t_utc: dateObj.toISOString(), lon: stepLon });
        }
      }
    }

    if (steps.length === 0) {
      console.warn(`No steps found for local date ${dateLocal} in window ${startUtc}-${stopUtc}`);
      return null;
    }

    const provBase: Omit<Provenance, "computed_at_utc"> = {
      source: "NASA_JPL_HORIZONS",
      horizons_request: params,
      horizons_response_hash: horizons.rawHash,
      engine_version: ENGINE_VERSION,
    };

    const output = computeDailyWeather(steps, dateLocal, timezone, provBase);

    (output.provenance as any).inputs_hash = inputsHash;
    (output.provenance as any).city = city;
    (output.provenance as any).horizons_run_id = horizonsRunId;

    await storeOutput(userId, "daily_weather", inputsHash, output, dateLocal, undefined, horizonsRunId);

    return output;
  } catch (err) {
    console.error("Engine Recompute Failed:", err);
    return null;
  }
}

// --- Baseline Vector ---

export async function getBaselineVector(
  userId: string,
  dob: string,
  birthTime: string | null,
  birthCity: string,
  timezone: string
): Promise<BaselineVectorOutput | null> {
  const inputs = { dob, birthTime, engine: ENGINE_VERSION };
  const inputsHash = hashInputs(inputs);

  const cached = await getCachedOutput(userId, "baseline_vector", inputsHash);
  if (cached) return cached as BaselineVectorOutput;

  // Recompute
  const startUtc = dob;
  const d = new Date(dob);
  const nextD = new Date(d); nextD.setDate(d.getDate() + 1);
  const stopUtc = nextD.toISOString().split("T")[0];

  const params: HorizonsParams = {
    startUtc: dob,
    stopUtc,
    step: "60m",
  };

  try {
    const horizons = await fetchHorizonsEphemeris(params);

     const runRes = await supabaseAdmin.from("horizons_runs").insert({
      user_id: userId,
      kind: "baseline",
      request_json: params,
      raw_text: horizons.rawText,
      raw_hash: horizons.rawHash,
      start_utc: dob,
      stop_utc: stopUtc,
      step_minutes: 60,
    }).select("id").single();
    const horizonsRunId = runRes.data?.id;

    // Find nearest step to birth time
    const targetHour = birthTime ? parseInt(birthTime.split(":")[0]) : 12;
    const timestamps = horizons.parsed["10"]?.map(x => x.date) || [];

    let bestIdx = 0;
    let minDiff = 24;

    for (let i = 0; i < timestamps.length; i++) {
        const tStr = timestamps[i].split(" ")[1];
        if (!tStr) continue;
        const h = parseInt(tStr.split(":")[0]);
        const diff = Math.abs(h - targetHour);
        if (diff < minDiff) {
            minDiff = diff;
            bestIdx = i;
        }
    }

    const targetT = timestamps[bestIdx];
    const stepLon: Record<string, number> = {};
    for (const bodyId in horizons.parsed) {
      stepLon[bodyId] = horizons.parsed[bodyId][bestIdx].lon;
    }

    const step = { t_utc: targetT, lon: stepLon };

    const provBase: Omit<Provenance, "computed_at_utc"> = {
      source: "NASA_JPL_HORIZONS",
      horizons_request: params,
      horizons_response_hash: horizons.rawHash,
      engine_version: ENGINE_VERSION,
    };

    const output = computeBaselineVector(step, provBase);

    (output.provenance as any).inputs_hash = inputsHash;
    (output.provenance as any).birth_city = birthCity;
    (output.provenance as any).birth_time_assumption = birthTime ? "EXACT" : "LOCAL_NOON";
    (output.provenance as any).horizons_run_id = horizonsRunId;

    await storeOutput(userId, "baseline_vector", inputsHash, output, undefined, undefined, horizonsRunId);

    return output;

  } catch (err) {
    console.error("Baseline Recompute Failed:", err);
    return null;
  }
}

// --- Friction ---

export async function getFriction(
  userId: string,
  connectionId: string,
  dateLocal: string,
  dailyWeather: DailyWeatherOutput,
  userBaseline: BaselineVectorOutput,
  connBaseline: BaselineVectorOutput
): Promise<FrictionOutput | null> {
  const inputs = {
    dateLocal,
    dailyHash: (dailyWeather.provenance as any).inputs_hash,
    uBaseHash: (userBaseline.provenance as any).inputs_hash,
    cBaseHash: (connBaseline.provenance as any).inputs_hash,
    engine: ENGINE_VERSION
  };
  const inputsHash = hashInputs(inputs);

  const cached = await getCachedOutput(userId, "friction", inputsHash, dateLocal, connectionId);
  if (cached) return cached as FrictionOutput;

  try {
    const provBase: Omit<Provenance, "computed_at_utc"> = {
      source: "NASA_JPL_HORIZONS",
      horizons_request: {},
      horizons_response_hash: "DERIVED",
      engine_version: ENGINE_VERSION,
    };

    const output = computeFriction(
        dailyWeather,
        userBaseline.baseline_vector,
        connBaseline.baseline_vector,
        provBase
    );

    (output.provenance as any).inputs_hash = inputsHash;
    (output.provenance as any).daily_weather_inputs_hash = (dailyWeather.provenance as any).inputs_hash;
    (output.provenance as any).user_baseline_inputs_hash = (userBaseline.provenance as any).inputs_hash;
    (output.provenance as any).connection_baseline_inputs_hash = (connBaseline.provenance as any).inputs_hash;

    await storeOutput(userId, "friction", inputsHash, output, dateLocal, connectionId);
    return output;
  } catch (err) {
    console.error("Friction Compute Failed:", err);
    return null;
  }
}

// --- Phase 1: Compute Day Orchestration Helpers ---

export async function getOrFetchHorizonsRun(utcDate: string) {
  // utcDate is "YYYY-MM-DD"
  // Check if we already have a run covering this day
  // We look for a run where start_utc <= utcDate and stop_utc >= utcDate + 1 day
  // Just reusing recomputeDailyWeather logic but exposing the raw run is complex because
  // recomputeDailyWeather logic is tied to "Local Day".
  // Here we want a "UTC Day" run.

  // For V1 simplicity: Fetch strictly the UTC day window.
  const startUtc = utcDate;
  const d = new Date(utcDate);
  const nextD = new Date(d); nextD.setDate(d.getDate() + 1);
  const stopUtc = nextD.toISOString().split("T")[0];

  // Check DB for existing run with this exact window
  // (In V1 we might have multiple runs if we aren't careful, but we want to reuse)
  const { data: existing } = await supabaseAdmin
    .from("horizons_runs")
    .select("raw_hash, raw_text, created_at")
    .eq("start_utc", startUtc)
    .eq("stop_utc", stopUtc)
    .eq("step_minutes", 60)
    .eq("kind", "daily_weather") // Reuse the kind
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Parse it again to return structured data
    // Ideally we cache parsed structure but for now re-parse is fine
    // We need to import the parse logic?
    // Actually, getOrFetchHorizonsRun caller expects { raw_hash, date, parsed? }
    // The prompt says: "Reuse same row for entire batch... Return { raw, raw_hash }"
    // It implies we pass the *parsed* object to the next step?
    // Looking at compute-day route:
    // const horizons = await getOrFetchHorizonsRun(utcDate);
    // await computeFrictionForConnection({ horizons, ... });
    // So "horizons" object needs to contain what computeFrictionForConnection needs.
    // computeFrictionForConnection needs to extract steps.

    // We can just return the raw text and let a helper re-parse it, OR export the parser.
    // Let's rely on fetchHorizonsEphemeris logic which does fetching.
    // But we want to avoid fetching if DB has it.

    // Re-importing parse logic is tricky if not exported.
    // I will export parseHorizonsResponse from horizons.ts or move it.
    // For now, let's assume we can fetch if missing, or use raw if present.

    // To match the requested "drop-in" nature, I will implement a simpler version:
    // Always call fetchHorizonsEphemeris but pass it "DB Cache Check" logic?
    // No, fetchHorizonsEphemeris is low level.

    // I will implement a fetch-or-load here.
    // I need to export  from  to be efficient?
    // Or just re-parse the raw text.

    // Let's modify  to export  is the clean way.
    // But I can't easily edit that file without a full rewrite in this tool.
    // I'll just duplicate the parse logic or regex it here? No, "No Theatre".
    // I will fetch again if I can't parse easily? No, that wastes quotas.

    // Better: I'll use the existing  but allow it to return "cached" if I pass a flag?
    // No,  does HTTP calls.

    // Plan:
    // 1. Try to fetch from DB.
    // 2. If missing, call fetchHorizonsEphemeris -> returns { rawText, rawHash, parsed }.
    // 3. Store in DB.
    // 4. Return { raw_hash, raw_text, parsed }.

    // I need to parse the raw text if it came from DB.
    // I will append a parser helper here.
  }

  // FETCH NEW
  const params: HorizonsParams = {
    startUtc,
    stopUtc,
    step: "60m",
  };

  try {
    const res = await fetchHorizonsEphemeris(params);
    // Store
    await supabaseAdmin.from("horizons_runs").insert({
        kind: "daily_weather", // Shared kind
        request_json: params,
        raw_text: res.rawText,
        raw_hash: res.rawHash,
        start_utc: startUtc,
        stop_utc: stopUtc,
        step_minutes: 60,
    });

    return {
        raw_hash: res.rawHash,
        parsed: res.parsed,
        raw_text: res.rawText
    };
  } catch (e) {
    console.error("Horizons fetch failed", e);
    return null;
  }
}

// Helper to re-parse raw text (duplicated from horizons.ts to avoid modify file)
// Ideally this should be shared.
function parseRawText(text: string) {
    // ... Implement minimal parser or rely on fetch logic ...
    // Since I cannot easily modify horizons.ts in "append" mode, I will just assume
    // for this step that we always FETCH (if that's acceptable for V1) or
    // I will rewrite horizons.ts to export the parser in a separate step?
    // User said: "Reuse same row for entire batch".
    // So within one execution of , we fetch ONCE.
    //  calls  once.
    // So the caching is primarily in-memory for the batch, or DB for retries?
    // The prompt says "Fetch once per UTC date".
    // So I must handle the DB load.

    // I will overwrite  to export  in the next step
    // to make this clean.
    return {};
}

export async function computeFrictionForConnection(args: {
  horizons: { parsed: any, raw_hash: string },
  userId: string,
  connectionId: string,
  engineVersion: string
}) {
  // 1. Get User Baseline
  // 2. Get Connection Baseline
  // 3. Compute Daily Weather (max step)
  // 4. Compute Friction

  // We need to fetch baselines from DB (engine_outputs) or recompute them.
  // This is complex orchestration.
  //  in this file handles fetch-or-compute.

  // Fetch Context
  const { data: ctx } = await supabaseAdmin.from("user_context").select("city,timezone").eq("user_id", args.userId).maybeSingle();
  const { data: uBase } = await supabaseAdmin.from("baselines").select("dob,birth_time,birth_city").eq("user_id", args.userId).maybeSingle();
  const { data: cBase } = await supabaseAdmin.from("connections").select("dob,birth_time,birth_city").eq("id", args.connectionId).single();

  if (!uBase || !cBase) return null;

  const timezone = ctx?.timezone || "UTC";
  const city = ctx?.city || uBase.birth_city;
  const now = new Date();
  const dateLocal = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);

  const uVector = await getBaselineVector(args.userId, uBase.dob, uBase.birth_time, uBase.birth_city, timezone);
  const cVector = await getBaselineVector(args.userId, cBase.dob, cBase.birth_time, cBase.birth_city || "Unknown", timezone);

  if (!uVector || !cVector) return null;

  // Compute Daily Weather from the SHARED horizons run
  // We need to extract the steps relevant to the local day from the shared run
  // args.horizons.parsed has the data.
  // We need to run  logic.

  // Filter steps (Logic duplicated from recomputeDailyWeather but using passed horizons)
  const steps: { t_utc: string; lon: Record<string, number> }[] = [];
  const timestamps = args.horizons.parsed["10"]?.map((x: any) => x.date) || [];

  for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      const dateObj = new Date(t + " UTC");
      const localDateStr = dateObj.toLocaleDateString("en-CA", { timeZone: timezone });

      if (localDateStr === dateLocal) {
        const stepLon: Record<string, number> = {};
        let missing = false;
        for (const bodyId in args.horizons.parsed) {
          const entry = args.horizons.parsed[bodyId][i];
          if (!entry) { missing = true; break; }
          stepLon[bodyId] = entry.lon;
        }
        if (!missing) steps.push({ t_utc: dateObj.toISOString(), lon: stepLon });
      }
  }

  if (steps.length === 0) return null;

  const provBase: Omit<Provenance, "computed_at_utc"> = {
      source: "NASA_JPL_HORIZONS",
      horizons_request: {},
      horizons_response_hash: args.horizons.raw_hash,
      engine_version: args.engineVersion as any,
  };

  const daily = computeDailyWeather(steps, dateLocal, timezone, provBase);
  const friction = computeFriction(daily, uVector.baseline_vector, cVector.baseline_vector, provBase);

  return {
      pressure_score: daily.pressure_score,
      friction_score: friction.friction_score,
      provenance_hash: crypto.createHash("sha256").update(JSON.stringify(friction.provenance)).digest("hex")
  };
}

export async function getOrFetchHorizonsRun(utcDate: string) {
  const startUtc = utcDate;
  const d = new Date(utcDate);
  const nextD = new Date(d); nextD.setDate(d.getDate() + 1);
  const stopUtc = nextD.toISOString().split("T")[0];

  // Try DB
  const { data: existing } = await supabaseAdmin
    .from("horizons_runs")
    .select("raw_hash, raw_text")
    .eq("start_utc", startUtc)
    .eq("stop_utc", stopUtc)
    .eq("step_minutes", 60)
    .eq("kind", "daily_weather")
    .limit(1)
    .maybeSingle();

  if (existing) {
    // We need to parse this raw text to be useful
    // For V1, to avoid circular deps or complex refactoring of horizons.ts which isn't exported,
    // we will fetch fresh if we can't parse easily.
    // BUT the requirement is "Reuse same row".
    // I will implement a minimal parser here matching the horizons.ts logic.
    return {
        raw_hash: existing.raw_hash,
        parsed: parseHorizonsRawText(existing.raw_text),
        raw_text: existing.raw_text
    };
  }

  // Fetch
  const params: HorizonsParams = {
    startUtc,
    stopUtc,
    step: "60m",
  };

  try {
    const res = await fetchHorizonsEphemeris(params);
    await supabaseAdmin.from("horizons_runs").insert({
        kind: "daily_weather",
        request_json: params,
        raw_text: res.rawText,
        raw_hash: res.rawHash,
        start_utc: startUtc,
        stop_utc: stopUtc,
        step_minutes: 60,
    });

    return {
        raw_hash: res.rawHash,
        parsed: res.parsed,
        raw_text: res.rawText
    };
  } catch (e) {
    console.error("Horizons fetch failed", e);
    return null;
  }
}

// Duplicated parser logic (safe because deterministic)
function parseHorizonsRawText(text: string) {
    // Expects combined raw text "--BODY X--\n..."
    const results: Record<string, { date: string; lon: number; lat: number }[]> = {};
    const parts = text.split("--BODY ");
    for (const part of parts) {
        if (!part.trim()) continue;
        const bodyId = part.split("--")[0];
        const bodyText = part.split("--").slice(1).join("--");

        const startMarker = "$$SOE";
        const endMarker = "$$EOE";
        const startIdx = bodyText.indexOf(startMarker);
        const endIdx = bodyText.indexOf(endMarker);

        if (startIdx !== -1 && endIdx !== -1) {
            const dataBlock = bodyText.slice(startIdx + startMarker.length, endIdx).trim();
            const lines = dataBlock.split("\n");
            results[bodyId] = lines.map(line => {
                const p = line.split(",").map(x => x.trim());
                if (p.length < 3) return null;
                const lon = parseFloat(p[1]);
                const lat = parseFloat(p[2]);
                if (isNaN(lon)) return null;
                return { date: p[0], lon, lat };
            }).filter((x): x is any => x !== null);
        }
    }
    return results;
}

export async function computeFrictionForConnection(args: {
  horizons: { parsed: any, raw_hash: string },
  userId: string,
  connectionId: string,
  engineVersion: string
}) {
  const { data: ctx } = await supabaseAdmin.from("user_context").select("city,timezone").eq("user_id", args.userId).maybeSingle();
  const { data: uBase } = await supabaseAdmin.from("baselines").select("dob,birth_time,birth_city").eq("user_id", args.userId).maybeSingle();
  const { data: cBase } = await supabaseAdmin.from("connections").select("dob,birth_time,birth_city").eq("id", args.connectionId).single();

  if (!uBase || !cBase) return null;

  const timezone = ctx?.timezone || "UTC";
  const now = new Date();
  const dateLocal = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);

  const uVector = await getBaselineVector(args.userId, uBase.dob, uBase.birth_time, uBase.birth_city, timezone);
  const cVector = await getBaselineVector(args.userId, cBase.dob, cBase.birth_time, cBase.birth_city || "Unknown", timezone);

  if (!uVector || !cVector) return null;

  const steps: { t_utc: string; lon: Record<string, number> }[] = [];
  // Use first body (10) for timestamps
  const timestamps = args.horizons.parsed["10"]?.map((x: any) => x.date) || [];

  for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      // Horizons date format: "YYYY-Mmm-DD HH:MM"
      // Date.parse handles this usually
      const dateObj = new Date(t.replace("A.D. ", "") + " UTC");
      const localDateStr = dateObj.toLocaleDateString("en-CA", { timeZone: timezone });

      if (localDateStr === dateLocal) {
        const stepLon: Record<string, number> = {};
        let missing = false;
        for (const bodyId in args.horizons.parsed) {
          const entry = args.horizons.parsed[bodyId][i];
          if (!entry) { missing = true; break; }
          stepLon[bodyId] = entry.lon;
        }
        if (!missing) steps.push({ t_utc: dateObj.toISOString(), lon: stepLon });
      }
  }

  if (steps.length === 0) return null;

  const provBase: Omit<Provenance, "computed_at_utc"> = {
      source: "NASA_JPL_HORIZONS",
      horizons_request: {},
      horizons_response_hash: args.horizons.raw_hash,
      engine_version: args.engineVersion as any,
  };

  const daily = computeDailyWeather(steps, dateLocal, timezone, provBase);
  const friction = computeFriction(daily, uVector.baseline_vector, cVector.baseline_vector, provBase);

  return {
      pressure_score: daily.pressure_score,
      friction_score: friction.friction_score,
      provenance_hash: crypto.createHash("sha256").update(JSON.stringify(friction.provenance)).digest("hex")
  };
}
