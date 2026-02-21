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

    const steps: { t_utc: string; lon: Record<string, number> }[] = [];
    const timestamps = horizons.parsed["10"]?.map(x => x.date) || [];

    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      const dateObj = new Date(t + " UTC");
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
  const timestamps = args.horizons.parsed["10"]?.map((x: any) => x.date) || [];

  for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
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
