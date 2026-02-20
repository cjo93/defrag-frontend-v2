import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { errorToResponse } from "@/lib/responses";
import { getDailyWeather, getBaselineVector, getFriction, checkRateLimit } from "@/lib/engine/service";
import { ENV } from "@/lib/env";

const Body = z.object({
  userId: z.string().uuid(),
  dateLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  connectionId: z.string().uuid(),
});

export async function OPTIONS(req: Request) { return handleOptions(req); }

export async function POST(req: Request) {
  try {
    const headers = corsHeaders(req);

    // Admin Check
    const adminKey = req.headers.get("x-defrag-admin-key");
    if (!adminKey || adminKey !== ENV.DEFRAG_ADMIN_KEY) {
      return new NextResponse("Unauthorized", { status: 401, headers });
    }

    // Rate Limit
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit("recompute:" + ip)) {
      return new NextResponse("Too Many Requests", { status: 429, headers });
    }

    const body = Body.parse(await req.json());
    const userId = body.userId;

    const [uBaseRes, uCtxRes, connRes] = await Promise.all([
      supabaseAdmin.from("baselines").select("dob,birth_time,birth_city").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("user_context").select("city,timezone").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("connections").select("id,name,dob,birth_time,birth_city").eq("user_id", userId).eq("id", body.connectionId).maybeSingle()
    ]);

    if (!uBaseRes.data || !connRes.data) {
       return NextResponse.json({ error: "Baseline or Connection missing" }, { status: 404, headers });
    }

    const city = uCtxRes.data?.city || uBaseRes.data.birth_city;
    const timezone = uCtxRes.data?.timezone || "UTC";

    const dailyWeather = await getDailyWeather(userId, body.dateLocal, timezone, city);
    const uBaseVector = await getBaselineVector(userId, uBaseRes.data.dob, uBaseRes.data.birth_time, uBaseRes.data.birth_city, timezone);
    const cBaseVector = await getBaselineVector(userId, connRes.data.dob, connRes.data.birth_time, connRes.data.birth_city || "Unknown", timezone);

    if (!dailyWeather || !uBaseVector || !cBaseVector) {
      return NextResponse.json({ error: "DATA_UNAVAILABLE" }, { status: 503, headers });
    }

    const result = await getFriction(userId, body.connectionId, body.dateLocal, dailyWeather, uBaseVector, cBaseVector);

    if (!result) return NextResponse.json({ error: "DATA_UNAVAILABLE" }, { status: 503, headers });

    return NextResponse.json(result, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
