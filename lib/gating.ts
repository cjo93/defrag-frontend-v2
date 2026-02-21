import { supabaseAdmin } from "./supabase-admin";
import { ForbiddenError } from "./auth";

export type SubscriptionStatus = "none" | "blueprint_unlocked" | "os_active";

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("subscription_status")
    .eq("user_id", userId)
    .single();

  if (error || !data?.subscription_status) return "none";
  return data.subscription_status as SubscriptionStatus;
}

export async function requireBlueprintOrOS(userId: string) {
  const status = await getSubscriptionStatus(userId);
  if (status !== "blueprint_unlocked" && status !== "os_active") throw new ForbiddenError();
  return status;
}

export async function requireOS(userId: string) {
  const status = await getSubscriptionStatus(userId);
  if (status !== "os_active") throw new ForbiddenError();
  return status;
}
