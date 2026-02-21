// USAGE:
// DEFRAG_ADMIN_KEY=... node scripts/release-gates.js (compiled) or use ts-node

import https from "https";

// Simple fetch polyfill for script usage if needed (or assume node 18+)
const fetch = global.fetch;

const API_URL = process.env.API_URL || "https://api.defrag.app";
const ADMIN_KEY = process.env.DEFRAG_ADMIN_KEY;

if (!ADMIN_KEY) {
  console.error("DEFRAG_ADMIN_KEY required");
  process.exit(1);
}

async function run() {
  console.log("Running Release Gates against:", API_URL);

  const results: any = {
    gate1_env: "SKIPPED (Manual Check)",
    gate3_schema: "SKIPPED (Manual Check)",
    gate4_compute: "PENDING",
    gate4_render: "PENDING",
    gate6_cron: "PENDING"
  };

  try {
    // GATE 4: Compute Day
    console.log("Triggering Compute Day...");
    const headers: Record<string, string> = { "x-defrag-admin-key": ADMIN_KEY as string };

    const res1 = await fetch(`${API_URL}/api/v1/admin/compute-day`, {
      method: "POST",
      headers: headers
    });

    if (res1.status === 200) {
      const j1 = await res1.json();
      console.log("Compute Day:", j1);
      results.gate4_compute = j1.ok ? "PASS" : "FAIL";
    } else {
      results.gate4_compute = `FAIL (${res1.status})`;
    }

    // GATE 4: Render Stills
    console.log("Triggering Render Stills...");
    const res2 = await fetch(`${API_URL}/api/v1/admin/render-stills?limit=1`, {
      method: "POST",
      headers: headers
    });

    if (res2.status === 200) {
        const j2 = await res2.json();
        console.log("Render Stills:", j2);
        results.gate4_render = j2.ok ? "PASS" : "FAIL";
    } else {
        results.gate4_render = `FAIL (${res2.status})`;
    }

    // GATE 6: Cron Auth Check (Simulate)
    if (process.env.CRON_SECRET) {
       console.log("Testing Cron Auth...");
       const cronHeaders: Record<string, string> = { "Authorization": `Bearer ${process.env.CRON_SECRET}` };
       const res3 = await fetch(`${API_URL}/api/v1/admin/compute-day`, {
         method: "POST",
         headers: cronHeaders
       });
       results.gate6_cron = res3.status === 200 ? "PASS" : `FAIL (${res3.status})`;
    } else {
       results.gate6_cron = "SKIPPED (No Secret)";
    }

  } catch (e) {
    console.error("Verification Error:", e);
    results.error = String(e);
  }

  console.table(results);
}

run();
