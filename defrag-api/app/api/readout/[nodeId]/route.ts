import { NextResponse } from "next/server";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { requireUserId } from "@/lib/auth";
import { requireOS } from "@/lib/gating";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { errorToResponse } from "@/lib/responses";

export async function OPTIONS(req: Request) { return handleOptions(req); }

export async function GET(req: Request, ctx: { params: Promise<{ nodeId: string }> }) {
  try {
    const headers = corsHeaders(req);
    const userId = await requireUserId(req);
    await requireOS(userId);

    const { nodeId } = await ctx.params;

    const { data: person, error } = await supabaseAdmin
      .from("connections")
      .select("id,name,relationship_type")
      .eq("user_id", userId)
      .eq("id", nodeId)
      .single();

    if (error) return NextResponse.json({ locked: false, not_found: true }, { headers });

    const insights = [
      { title: "Friction", category: "friction", content: "This pairing tends to escalate when timing is forced. Keep decisions small. Confirm one point at a time." },
      { title: "Do this", category: "energy_style", content: "If tension starts, lower volume. Ask what outcome they want. Then offer two options." },
      { title: "Avoid", category: "family_echoes", content: "Avoid explaining yourself repeatedly. It increases resistance." },
      { title: "Why", category: "daily_weather", content: "You process stress differently. The mismatch looks like disrespect, but it’s pacing." },
    ];

    return NextResponse.json({ locked: false, personName: person.name, insights }, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
