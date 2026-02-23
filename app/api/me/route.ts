import { NextResponse } from "next/server";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { requireUserId } from "@/lib/auth";
import { getSubscriptionStatus } from "@/lib/gating";
import { errorToResponse } from "@/lib/responses";

export async function OPTIONS(req: Request) { return handleOptions(req); }

export async function GET(req: Request) {
  try {
    const headers = corsHeaders(req);
    const userId = await requireUserId(req);
    const status = await getSubscriptionStatus(userId);

    return NextResponse.json({ subscription: status }, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
