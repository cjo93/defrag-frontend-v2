import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ENV } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });

  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, ENV.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;

    const userId = session.client_reference_id as string | undefined;
    const access = session.metadata?.access_level as string | undefined;

    if (userId && access) {
      const subscription_status =
        access === "os_active" ? "os_active" :
        access === "blueprint" ? "blueprint_unlocked" :
        "none";

      // Ensure profile exists + update status
      await supabaseAdmin.from("profiles").upsert({
        user_id: userId,
        subscription_status,
        updated_at: new Date().toISOString(),
      });
    }
  }

  return NextResponse.json({ received: true });
}
