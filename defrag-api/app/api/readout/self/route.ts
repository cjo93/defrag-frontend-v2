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

    // Gate
    await requireBlueprintOrOS(userId);

    // Ensure baseline exists; if not, instruct frontend
    const { data: baseline } = await supabaseAdmin
      .from("baselines")
      .select("dob,birth_time,birth_city")
      .eq("user_id", userId)
      .maybeSingle();

    if (!baseline) {
      return NextResponse.json({ locked: false, needs_baseline: true }, { headers });
    }

    // V1: deterministic “manual” placeholders (no engine logic revealed)
    const insights = [
      { title: "Energy Style", category: "energy_style", content: "You work best when you respond to what is real in front of you. Reduce self-pressure. Choose fewer, cleaner actions." },
      { title: "Friction", category: "friction", content: "When tension rises, your system moves fast. Slow down first. Ask one clarifying question before acting." },
      { title: "Family Echoes", category: "family_echoes", content: "If you feel responsible for everyone’s mood, pause. That pattern is learned. You can step out without abandoning anyone." },
      { title: "Daily Weather", category: "daily_weather", content: "Today is suited for clean decisions. Avoid loaded conversations late at night." },
    ];

    return NextResponse.json({ locked: false, insights }, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
