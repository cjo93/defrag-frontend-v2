import { NextResponse } from "next/server";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { requireUserId } from "@/lib/auth";
import { requireBlueprintOrOS } from "@/lib/gating";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { errorToResponse } from "@/lib/responses";

export async function OPTIONS(req: Request) { return handleOptions(req); }

export async function GET(req: Request) {
  try {
    const headers = corsHeaders(req);
    const userId = await requireUserId(req);
    const tier = await requireBlueprintOrOS(userId);

    const [profileRes, ctxRes, baseRes, conRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("user_id,email,subscription_status").eq("user_id", userId).single(),
      supabaseAdmin.from("user_context").select("city,timezone").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("baselines").select("dob,birth_time,birth_city").eq("user_id", userId).maybeSingle(),
      tier === "os_active"
        ? supabaseAdmin.from("connections").select("id,name,relationship_type,dob,birth_time,birth_city").eq("user_id", userId).order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (profileRes.error) throw profileRes.error;

    const bundle = {
      owner_id: userId,
      subscription_status: profileRes.data.subscription_status,
      context: ctxRes.data ?? null,
      baseline: baseRes.data ?? null,
      connections: conRes.data ?? [],
      generated_at: new Date().toISOString(),
    };

    // This bundle is for server use and future UI; do not pass raw bundle to LLM.
    return NextResponse.json(bundle, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
