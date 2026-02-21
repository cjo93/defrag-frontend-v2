import { ENV } from "../lib/env";

console.log("Checking Environment Variables...");

const REQUIRED = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DEFRAG_ADMIN_KEY",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "AI_GATEWAY_URL",
  "OPENAI_API_KEY"
];

let missing = 0;

for (const key of REQUIRED) {
  const val = process.env[key];
  if (!val || val.length === 0) {
    console.error(`❌ Missing: ${key}`);
    missing++;
  } else {
    console.log(`✅ Present: ${key}`);
  }
}

if (missing > 0) {
  console.error(`\nTotal Missing: ${missing}`);
  process.exit(1);
} else {
  console.log("\nAll required variables present.");
  process.exit(0);
}
