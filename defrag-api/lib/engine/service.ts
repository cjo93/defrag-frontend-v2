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

// Canonical JSON Hashing
function hashInputs(inputs: any): string {
  // Sort keys recursively? For V1 flat inputs object is enough.
  // Actually, let's just use a stable stringify if available, or sort keys.
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
  // Fetch wider window to ensure local day coverage
  const d = new Date(dateLocal);
  const start = new Date(d);
  start.setDate(start.getDate() - 1);
  const end = new Date(d);
  end.setDate(end.getDate() + 2);

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
      user_id: userId, // Service role writes
      kind: "daily_weather",
      request_json: params,
      raw_text: horizons.rawText,
      raw_hash: horizons.rawHash,
      start_utc: startUtc,
      stop_utc: stopUtc,
      step_minutes: 60,
    }).select("id").single();

    const horizonsRunId = runRes.data?.id;

    // Filter steps for local day
    const steps: { t_utc: string; lon: Record<string, number> }[] = [];
    // horizons.parsed["10"] exists
    const timestamps = horizons.parsed["10"]?.map(x => x.date) || [];

    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      // t format: "2026-Jan-28 00:00"
      // Convert to Date object (UTC)
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
  // Fetch day of birth
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

     // Store run
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

    // Find nearest step to birth time (or 12:00 if null)
    const targetHour = birthTime ? parseInt(birthTime.split(":")[0]) : 12;
    const timestamps = horizons.parsed["10"]?.map(x => x.date) || [];

    let bestIdx = 0;
    let minDiff = 24;

    for (let i = 0; i < timestamps.length; i++) {
        const tStr = timestamps[i].split(" ")[1]; // "13:00"
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
