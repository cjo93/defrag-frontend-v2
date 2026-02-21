import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { requireUserId } from "@/lib/auth";
import { requireOS } from "@/lib/gating";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { errorToResponse } from "@/lib/responses";

const Create = z.object({
  name: z.string().min(1).max(60),
  relationship_type: z.string().min(1).max(40),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birth_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
  birth_city: z.string().max(80).optional().nullable(),
});

export async function OPTIONS(req: Request) { return handleOptions(req); }

export async function POST(req: Request) {
  try {
    const headers = corsHeaders(req);
    const userId = await requireUserId(req);
    await requireOS(userId);

    const body = Create.parse(await req.json());
    const { data, error } = await supabaseAdmin
      .from("connections")
      .insert({
        user_id: userId,
        name: body.name,
        relationship_type: body.relationship_type,
        dob: body.dob,
        birth_time: body.birth_time ?? null,
        birth_city: body.birth_city ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id }, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function GET(req: Request) {
  try {
    const headers = corsHeaders(req);
    const userId = await requireUserId(req);

    // Listing connections is OS-only (keeps V1 clean)
    await requireOS(userId);

    const { data, error } = await supabaseAdmin
      .from("connections")
      .select("id,name,relationship_type,dob,birth_time,birth_city,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ connections: data }, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
