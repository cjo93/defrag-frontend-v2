import { NextResponse } from "next/server";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { requireUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { errorToResponse } from "@/lib/responses";

export async function OPTIONS(req: Request) { return handleOptions(req); }

export async function GET(req: Request) {
  try {
    const headers = corsHeaders(req);
    const userId = await requireUserId(req);

    // 1. Determine local date
    const { data: ctx } = await supabaseAdmin.from("user_context").select("timezone").eq("user_id", userId).maybeSingle();
    const tz = ctx?.timezone || "UTC";
    const now = new Date();
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);

    // 2. Fetch daily frag
    const { data: frag, error } = await supabaseAdmin
      .from("daily_frags")
      .select("*")
      .eq("user_id", userId)
      .eq("local_date", localDate)
      .maybeSingle();

    if (error) throw error;
    if (!frag) {
      // Nothing materialized yet. Return empty/processing state.
      // Or trigger compute-day if on-demand is allowed? (V1: pre-computed only)
      return NextResponse.json({ status: "PENDING" }, { headers });
    }

    // 3. Fetch asset status
    const { data: asset } = await supabaseAdmin
      .from("asset_cache_public")
      .select("status, url, width, height")
      .eq("hash", frag.asset_hash)
      .maybeSingle();

    return NextResponse.json({
      status: "READY",
      frag: {
        ...frag,
        asset_status: asset?.status || "MISSING",
        asset_url: asset?.url || null,
        asset_width: asset?.width || null,
        asset_height: asset?.height || null,
      }
    }, { headers });

  } catch (err) {
    return errorToResponse(err);
  }
}
