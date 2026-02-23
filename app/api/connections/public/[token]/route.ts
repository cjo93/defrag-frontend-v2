import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { errorToResponse } from "@/lib/responses";

const TokenParam = z.string().uuid();

const UpdateSchema = z.object({
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birth_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
  birth_city: z.string().max(80).optional().nullable(),
});

export async function OPTIONS(req: Request) { return handleOptions(req); }

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const headers = corsHeaders(req);
    // Properly await params in Next.js 15+ (if applicable, usually safe to await)
    const { token } = await params;
    const validToken = TokenParam.parse(token);

    // Get connection details by token (public route)
    // Only return name and relationship (for verification by the relative)
    const { data, error } = await supabaseAdmin
      .from("connections")
      .select("name, relationship_type, status")
      .eq("invite_token", validToken)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "INVITE_NOT_FOUND" }, { status: 404, headers });

    if (data.status === 'active') {
       return NextResponse.json({ error: "ALREADY_COMPLETED", name: data.name }, { headers });
    }

    return NextResponse.json({
      valid: true,
      name: data.name,
      relationship_type: data.relationship_type
    }, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const headers = corsHeaders(req);
    const { token } = await params;
    const validToken = TokenParam.parse(token);

    const body = UpdateSchema.parse(await req.json());

    // Update the connection
    const { error } = await supabaseAdmin
      .from("connections")
      .update({
        dob: body.dob,
        birth_time: body.birth_time || null,
        birth_city: body.birth_city || null,
        status: 'active',
        invite_token: null // Clear token after use for security
      })
      .eq("invite_token", validToken);

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
