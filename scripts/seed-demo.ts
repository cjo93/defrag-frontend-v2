// scripts/seed-demo.ts
// Usage: DEFRAG_ADMIN_KEY=... node scripts/seed-demo.js
// Requires local environment with supabaseAdmin configured (or mock it).
// Since we are in production mode, this script should probably interact via API
// OR use the service role key directly if run in a trusted env.
// For safety, we will make this generate SQL or instructions,
// OR use the admin client if env vars are present.

import { supabaseAdmin } from "../lib/supabase-admin";

async function seed() {
  console.log("Seeding Demo Data...");

  // 1. Create User (if not exists - hard via admin API, usually done via Auth)
  // We'll assume a user exists. Paste their ID here.
  const USER_ID = process.env.TEST_USER_ID;
  if (!USER_ID) {
    console.error("TEST_USER_ID env var required");
    return;
  }

  // 2. Create Connection
  const { data: conn, error: connErr } = await supabaseAdmin.from("connections").insert({
    user_id: USER_ID,
    name: "Demo Connection",
    relationship_type: "Partner",
    dob: "1990-01-01",
    birth_time: "12:00",
    birth_city: "Los Angeles",
  }).select("id").single();

  if (connErr) {
    console.error("Connection create failed:", connErr);
    return;
  }
  console.log("Created Connection:", conn.id);

  // 3. Pin Connection
  const { error: pinErr } = await supabaseAdmin.from("pinned_connections").insert({
    user_id: USER_ID,
    connection_id: conn.id
  });

  if (pinErr) console.error("Pin failed:", pinErr);
  else console.log("Connection Pinned.");

  // 4. Ensure Baseline
  await supabaseAdmin.from("baselines").upsert({
    user_id: USER_ID,
    dob: "1988-08-08",
    birth_time: "08:00",
    birth_city: "New York",
  });
  console.log("Baseline Ensured.");
}

seed().catch(console.error);
