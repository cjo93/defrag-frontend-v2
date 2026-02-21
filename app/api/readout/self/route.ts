import { NextResponse } from "next/server";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { requireUserId } from "@/lib/auth";
import { requireBlueprintOrOS } from "@/lib/gating";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { errorToResponse } from "@/lib/responses";
// Direct Import of service functions
import { getDailyWeather, getBaselineVector } from "@/lib/engine/service";

export async function OPTIONS(req: Request) { return handleOptions(req); }

export async function GET(req: Request) {
  try {
    const headers = corsHeaders(req);
    const userId = await requireUserId(req);

    // Gate
    await requireBlueprintOrOS(userId);

    // Fetch baseline & context
    const [baseRes, ctxRes] = await Promise.all([
      supabaseAdmin.from("baselines").select("dob,birth_time,birth_city").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("user_context").select("city,timezone").eq("user_id", userId).maybeSingle(),
    ]);

    if (!baseRes.data) {
      return NextResponse.json({ locked: false, needs_baseline: true }, { headers });
    }

    const city = ctxRes.data?.city || baseRes.data.birth_city;
    const timezone = ctxRes.data?.timezone || "UTC";

    // Current time in their timezone -> Local Date
    const now = new Date();
    // Use Intl to get YYYY-MM-DD
    const dateLocal = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);

    // Real Engine Compute (Parallel)
    const [dailyWeather, baselineVector] = await Promise.all([
      getDailyWeather(userId, dateLocal, timezone, city),
      getBaselineVector(userId, baseRes.data.dob, baseRes.data.birth_time, baseRes.data.birth_city, timezone)
    ]);

    if (!dailyWeather || !baselineVector) {
      return NextResponse.json({ error: "DATA_UNAVAILABLE" }, { status: 503, headers: corsHeaders(req) });
    }

    // Build Response
    const insights = [
      {
        title: "Daily Weather",
        category: "daily_weather",
        content: `Pressure Score: ${dailyWeather.pressure_score}. Band: ${dailyWeather.weather_band}.`
      },
      ...dailyWeather.signals.map(s => ({
        title: "Signal",
        category: "signal",
        content: `${s.key} (Strength: ${s.strength.toFixed(2)})`
      }))
    ];

    return NextResponse.json({
      locked: false,
      daily_weather: dailyWeather,
      baseline_vector: baselineVector,
      insights
    }, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
