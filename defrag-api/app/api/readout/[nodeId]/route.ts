import { NextResponse } from "next/server";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { requireUserId } from "@/lib/auth";
import { requireOS } from "@/lib/gating";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { errorToResponse } from "@/lib/responses";
import { getDailyWeather, getBaselineVector, getFriction } from "@/lib/engine/service";

export async function OPTIONS(req: Request) { return handleOptions(req); }

export async function GET(req: Request, ctx: { params: Promise<{ nodeId: string }> }) {
  try {
    const headers = corsHeaders(req);
    const userId = await requireUserId(req);
    await requireOS(userId);

    const { nodeId } = await ctx.params;

    // Fetch User Baseline & Context
    // We also need the connection data to compute THEIR baseline
    const [uBaseRes, uCtxRes, connRes] = await Promise.all([
      supabaseAdmin.from("baselines").select("dob,birth_time,birth_city").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("user_context").select("city,timezone").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("connections").select("id,name,dob,birth_time,birth_city").eq("user_id", userId).eq("id", nodeId).maybeSingle()
    ]);

    if (!uBaseRes.data || !connRes.data) {
       return NextResponse.json({ locked: false, not_found: true }, { headers });
    }

    const city = uCtxRes.data?.city || uBaseRes.data.birth_city;
    const timezone = uCtxRes.data?.timezone || "UTC";

    let dateLocal: string;
    try {
        dateLocal = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
    } catch {
        dateLocal = new Date().toISOString().split("T")[0];
    }

    // 1. Get User Daily Weather
    const dailyWeather = await getDailyWeather(userId, dateLocal, timezone, city);

    // 2. Get User Baseline Vector
    const uBaseVector = await getBaselineVector(userId, uBaseRes.data.dob, uBaseRes.data.birth_time, uBaseRes.data.birth_city, timezone);

    // 3. Get Connection Baseline Vector (Use their birth data, store under user run)
    const cBaseVector = await getBaselineVector(
        userId,
        connRes.data.dob,
        connRes.data.birth_time,
        connRes.data.birth_city || "Unknown",
        timezone
    );

    if (!dailyWeather || !uBaseVector || !cBaseVector) {
       return NextResponse.json({ error: "DATA_UNAVAILABLE" }, { status: 503, headers });
    }

    // 4. Compute Friction
    const friction = await getFriction(userId, nodeId, dateLocal, dailyWeather, uBaseVector, cBaseVector);

    if (!friction) {
       return NextResponse.json({ error: "DATA_UNAVAILABLE" }, { status: 503, headers });
    }

    // Build Insights for backward compat
    const insights = [
      {
        title: "Friction Score",
        category: "friction",
        content: `Score: ${friction.friction_score}.`
      },
      ...friction.drivers.map(d => ({
         title: "Driver",
         category: "driver",
         content: `Pair ${d.pair} (Strength: ${d.c.toFixed(2)})`
      }))
    ];

    return NextResponse.json({
        locked: false,
        personName: connRes.data.name,
        friction,
        insights
    }, { headers });

  } catch (err) {
    return errorToResponse(err);
  }
}
