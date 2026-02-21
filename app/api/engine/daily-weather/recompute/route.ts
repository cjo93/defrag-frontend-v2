import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { errorToResponse } from "@/lib/responses";
import { getDailyWeather, checkRateLimit } from "@/lib/engine/service";
import { ENV } from "@/lib/env";

const Body = z.object({
  userId: z.string().uuid(),
  dateLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

    // Fetch context
    const { data: ctx } = await supabaseAdmin.from("user_context").select("city,timezone").eq("user_id", userId).maybeSingle();
    const { data: base } = await supabaseAdmin.from("baselines").select("birth_city").eq("user_id", userId).maybeSingle();

    if (!base) return NextResponse.json({ error: "No baseline" }, { status: 400, headers });

    const city = ctx?.city || base.birth_city;
    const timezone = ctx?.timezone || "UTC";

    // Recompute (which fetches if needed)
    const result = await getDailyWeather(userId, body.dateLocal, timezone, city);

    if (!result) return NextResponse.json({ error: "DATA_UNAVAILABLE" }, { status: 503, headers });

    return NextResponse.json(result, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
