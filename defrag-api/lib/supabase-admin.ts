import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";

// Critical assertion for Phase 1 stability
if (!ENV.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations cannot proceed.");
}

export const supabaseAdmin = createClient(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
