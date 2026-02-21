import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { requireUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { errorToResponse } from "@/lib/responses";

const Body = z.object({
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birth_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
  birth_city: z.string().min(1).max(80),
});

export async function OPTIONS(req: Request) { return handleOptions(req); }

export async function PUT(req: Request) {
  try {
    const headers = corsHeaders(req);
    const userId = await requireUserId(req);
    const body = Body.parse(await req.json());

    // Keep single baseline row per user (simple V1)
    await supabaseAdmin.from("baselines").delete().eq("user_id", userId);
    await supabaseAdmin.from("baselines").insert({
      user_id: userId,
      dob: body.dob,
      birth_time: body.birth_time ?? null,
      birth_city: body.birth_city,
    });

    // Ensure profile exists
    await supabaseAdmin.from("profiles").upsert({
      user_id: userId,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true }, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
