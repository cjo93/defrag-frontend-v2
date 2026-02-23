import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { uploadPngToR2 } from "@/lib/storage/r2";
import { renderStill } from "@/lib/render/stills/renderStill";
import type { RenderInputs } from "@/lib/render/stills/types";

export const runtime = "nodejs";

function requireAdmin(req: Request) {
  const a = req.headers.get("authorization");
  const k = req.headers.get("x-defrag-admin-key");
  // Check Cron Secret (Bearer) OR Admin Key (x-defrag-admin-key)
  const okBearer = a && process.env.CRON_SECRET && a === `Bearer ${process.env.CRON_SECRET}`;
  const okKey = k && process.env.DEFRAG_ADMIN_KEY && k === process.env.DEFRAG_ADMIN_KEY;
  if (!okBearer && !okKey) return false;
  return true;
}

export async function POST(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const limit = Math.min(parseInt(new URL(req.url).searchParams.get("limit") || "25", 10), 50);

  // 1) Fetch candidates (public)
  const { data: candidates, error: candErr } = await supabaseAdmin
    .from("asset_cache_public")
    .select("hash, type, status")
    .eq("type", "STILL")
    .in("status", ["MISSING", "QUEUED"])
    .limit(limit);

  if (candErr) {
    return NextResponse.json({ ok: false, error: candErr.message }, { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, results: [] });
  }

  const results: Array<{ hash: string; status: "READY" | "FAILED" }> = [];

  for (const c of candidates) {
    const hash = c.hash;

    try {
      // 2a) Mark as QUEUED (idempotent)
      await supabaseAdmin
        .from("asset_cache_public")
        .update({ status: "QUEUED" })
        .eq("hash", hash);

      // 2b) Load private params (service role only table)
      // We select the discrete columns to map to RenderInputs
      const { data: priv, error: privErr } = await supabaseAdmin
        .from("asset_cache_private")
        .select("*")
        .eq("hash", hash)
        .maybeSingle();

      if (privErr || !priv) {
        await supabaseAdmin
          .from("asset_cache_public")
          .update({ status: "FAILED", url: null, width: null, height: null, duration_seconds: null })
          .eq("hash", hash);

        results.push({ hash, status: "FAILED" });
        continue;
      }

      // Map discrete DB columns to RenderInputs
      const inputs: RenderInputs = {
        hash: hash,
        userClass: priv.user_class,
        targetClass: priv.target_class,
        pressureBucket: priv.pressure_bucket,
        fidelityBucket: priv.fidelity_bucket,
        frictionBracket10: priv.friction_bracket10,
        assetVersion: priv.asset_version,
      };

      // 2c) Render
      const rendered = await renderStill(inputs);

      // 2d) Upload
      const key = `stills/${hash}.png`;
      const uploaded = await uploadPngToR2({
        key,
        body: rendered.png,
        cacheControl: "public, max-age=31536000, immutable",
      });

      // 2e) Update public record
      const { error: updErr } = await supabaseAdmin
        .from("asset_cache_public")
        .update({
          status: "READY",
          url: uploaded.publicUrl, // Fix: Changed from .url to .publicUrl
          width: rendered.width,
          height: rendered.height,
          duration_seconds: null,
        })
        .eq("hash", hash);

      if (updErr) throw new Error(updErr.message);

      results.push({ hash, status: "READY" });
    } catch (e: any) {
      // fail-closed
      await supabaseAdmin
        .from("asset_cache_public")
        .update({ status: "FAILED", url: null, width: null, height: null, duration_seconds: null })
        .eq("hash", hash);

      results.push({ hash, status: "FAILED" });
    }
  }

  const processed = results.length;
  const ready = results.filter((r) => r.status === "READY").length;
  const failed = results.filter((r) => r.status === "FAILED").length;

  return NextResponse.json({ ok: true, processed, ready, failed, results });
}
