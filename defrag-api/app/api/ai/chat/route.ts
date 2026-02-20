import { NextResponse } from "next/server";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { requireUserId } from "@/lib/auth";
import { requireOS } from "@/lib/gating";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ENV } from "@/lib/env";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { computeTier } from "@/lib/ai/tier";
import { ChatOutSchema } from "@/lib/ai/guards";
import { violatesDisclosure, safeFallback } from "@/lib/sanitize";
import { errorToResponse } from "@/lib/responses";
import { z } from "zod";

const InSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
});

export async function OPTIONS(req: Request) { return handleOptions(req); }

export async function POST(req: Request) {
  try {
    const headers = corsHeaders(req);
    const userId = await requireUserId(req);
    await requireOS(userId);

    const input = InSchema.parse(await req.json());
    const tier = computeTier(input.message);

    // Get or create conversation
    let conversationId = input.conversationId;
    if (!conversationId) {
      const created = await supabaseAdmin
        .from("conversations")
        .insert({ user_id: userId })
        .select("id")
        .single();
      conversationId = created.data?.id;
    }

    // Store user message
    await supabaseAdmin.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: input.message,
    });

    // Fetch recent message history (last 10)
    const historyRes = await supabaseAdmin
      .from("messages")
      .select("role,content,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(10);

    const history = (historyRes.data || []).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    // Pull network bundle server-side (DO NOT pass raw bundle to LLM)
    const [ctxRes, baseRes] = await Promise.all([
      supabaseAdmin.from("user_context").select("city,timezone").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("baselines").select("dob,birth_time,birth_city").eq("user_id", userId).maybeSingle(),
    ]);

    // Build a sanitized "Signal Packet" (no computation details)
    const signalPacket = {
      tier,
      signals: [
        { label: "Energy Style", summary: "User tends to escalate when rushed. Needs pacing.", certainty: "medium" },
        { label: "Friction", summary: "High sensitivity to tone and timing during conflict.", certainty: "medium" },
        { label: "Daily Weather", summary: "Keep decisions small. Avoid late-night conflict.", certainty: "low" },
        { label: "Family Echoes", summary: "User may default to responsibility-taking under stress.", certainty: "low" },
      ],
      context: {
        city: ctxRes.data?.city ?? null,
        timezone: ctxRes.data?.timezone ?? null,
        baselinePresent: !!baseRes.data,
      },
    };

    // Call AI Gateway (OpenAI compatible)
    const aiRes = await fetch(`${ENV.AI_GATEWAY_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ENV.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini", // Jules can change later; keep stable now
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: `Internal tier: ${tier}. Do not mention tiers.` },
          { role: "system", content: `Signal packet: ${JSON.stringify(signalPacket)}` },
          ...history,
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const fallback = safeFallback();
      await supabaseAdmin.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: JSON.stringify(fallback),
      });
      return NextResponse.json({ conversationId, ...fallback }, { headers });
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }

    const safe = parsed ? ChatOutSchema.safeParse(parsed) : { success: false as const };
    const out = safe.success ? safe.data : safeFallback();

    // Disclosure guard
    const joined = `${out.headline}\n${out.happening}\n${out.doThis}\n${out.avoid}\n${out.sayThis}`;
    const finalOut = violatesDisclosure(joined) ? safeFallback() : out;

    // Store assistant message as JSON string
    await supabaseAdmin.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: JSON.stringify(finalOut),
    });

    return NextResponse.json({ conversationId, ...finalOut }, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
