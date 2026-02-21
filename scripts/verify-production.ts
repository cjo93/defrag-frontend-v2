// USAGE:
// DEFRAG_API_URL=https://api.defrag.app DEFRAG_ADMIN_KEY=... node scripts/verify-production.js

const API_URL = process.env.DEFRAG_API_URL || "https://api.defrag.app";
const ADMIN_KEY = process.env.DEFRAG_ADMIN_KEY;

if (!ADMIN_KEY) {
  console.error("Error: DEFRAG_ADMIN_KEY env var required");
  process.exit(1);
}

async function verify() {
  console.log(`Verifying Production: ${API_URL}`);

  // 1. Check Public Health (via readout/self - requires token, so skip or use admin workaround?)
  // Actually, we can check a public asset or health check if one existed.
  // We'll check the Admin Compute Day route (should return 401 without key, 200 with key).

  console.log("\n--- Checking Admin Auth ---");
  const resAuth = await fetch(`${API_URL}/api/v1/admin/compute-day`, { method: "POST" });
  if (resAuth.status === 401) {
    console.log("✅ Admin route correctly rejects missing key (401)");
  } else {
    console.error(`❌ Admin route failed to reject missing key (Status: ${resAuth.status})`);
  }

  // 2. Trigger Compute Day (Dry run concept, or actual?)
  // This is operational. We will trigger it.
  console.log("\n--- Triggering Compute Day ---");
  const headers: Record<string, string> = { "x-defrag-admin-key": ADMIN_KEY as string };
  const resCompute = await fetch(`${API_URL}/api/v1/admin/compute-day`, {
    method: "POST",
    headers: headers
  });

  if (resCompute.ok) {
    const json = await resCompute.json();
    console.log("✅ Compute Day Success:", JSON.stringify(json, null, 2));
    if (json.nasaRawHash) console.log("   - NASA Hash present");
    else console.error("   ❌ Missing NASA Hash");
  } else {
    console.error(`❌ Compute Day Failed: ${resCompute.status} ${resCompute.statusText}`);
    console.error(await resCompute.text());
  }

  // 3. Trigger Render Stills
  console.log("\n--- Triggering Render Stills ---");
  const resRender = await fetch(`${API_URL}/api/v1/admin/render-stills?limit=5`, {
    method: "POST",
    headers: headers
  });

  if (resRender.ok) {
    const json = await resRender.json();
    console.log("✅ Render Stills Success:", JSON.stringify(json, null, 2));
    if (json.ok) console.log("   - Status OK");
  } else {
    console.error(`❌ Render Stills Failed: ${resRender.status}`);
  }

  console.log("\n--- Verification Complete ---");
}

verify().catch(console.error);
