import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, handleOptions } from "@/lib/cors";
import { requireUserId } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { ENV } from "@/lib/env";
import { errorToResponse } from "@/lib/responses";

const BodySchema = z.object({
  mode: z.enum(["blueprint", "os"]),
});

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  try {
    const headers = corsHeaders(req);
    const userId = await requireUserId(req);
    const body = BodySchema.parse(await req.json());

    const isOS = body.mode === "os";
    // Pricing: 2 for OS (subscription), 1 for Manual/Blueprint (payment)
    const price = isOS ? ENV.STRIPE_PRICE_OS : ENV.STRIPE_PRICE_BLUEPRINT;

    const session = await stripe.checkout.sessions.create({
      mode: isOS ? "subscription" : "payment",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: userId,
      // Metadata indicates what access level this purchase unlocks
      metadata: { access_level: isOS ? "os_active" : "blueprint_unlocked" },
      success_url: `${ENV.APP_URL}${isOS ? "/grid" : "/readout/self"}?success=1`,
      cancel_url: `${ENV.APP_URL}/connect?canceled=1`,
    });

    return NextResponse.json({ url: session.url }, { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
