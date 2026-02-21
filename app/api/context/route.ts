import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { requireUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { errorToResponse } from "@/lib/responses";

const Body = z.object({
  city: z.string().min(1).max(80),
  timezone: z.string().min(1).max(80),
});

export async function OPTIONS(req: Request) { return handleOptions(req); }

export async function PUT(req: Request) {
  try {
    const headers = corsHeaders(req);
    const userId = await requireUserId(req);
    const body = Body.parse(await req.json());

    await supabaseAdmin.from("user_context").upsert({
      user_id: userId,
      city: body.city,
      timezone: body.timezone,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true }, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
