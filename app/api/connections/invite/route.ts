import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { requireUserId } from "@/lib/auth";
import { requireOS } from "@/lib/gating";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { errorToResponse } from "@/lib/responses";
import { ENV } from "@/lib/env";

const InviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(60),
  relationship_type: z.string().min(1).max(40),
});

export async function OPTIONS(req: Request) { return handleOptions(req); }

export async function POST(req: Request) {
  try {
    const headers = corsHeaders(req);
    const userId = await requireUserId(req);

    // Gating: Only OS subscribers can add connections/invites
    await requireOS(userId);

    const body = InviteSchema.parse(await req.json());

    // Create a pending connection
    // We use service role to ensure RLS doesn't block (though we have insert policies)
    const { data, error } = await supabaseAdmin
      .from("connections")
      .insert({
        user_id: userId,
        name: body.name,
        relationship_type: body.relationship_type,
        invite_email: body.email,
        status: "pending",
        // dob and birth_city are nullable now, so we omit them
      })
      .select("invite_token")
      .single();

    if (error) throw error;

    const token = data.invite_token;
    // Magic Link format: /align/[token] (Frontend route)
    const inviteLink = `${ENV.APP_URL}/align/${token}`;

    // In a real production system, we would trigger an email here via Resend or similar.
    // For now, return the link so the frontend can display it or copy to clipboard.

    return NextResponse.json({
      success: true,
      inviteLink
    }, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
