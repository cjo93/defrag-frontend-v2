import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderStillFromHash } from "@/lib/render/stills/renderStill";
import { uploadPngToR2 } from "@/lib/storage/r2";

export const runtime = "nodejs";

function requireAdminKey(req: Request) {
  const key = req.headers.get("x-defrag-admin-key") || "";
  if (!env.DEFRAG_ADMIN_KEY || key !== env.DEFRAG_ADMIN_KEY) {
    return false;
  }
  return true;
}

export async function POST(req: Request) {
  if (!requireAdminKey(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10), 100);

  // Only consume asset_cache_public. Never touches frags/events.
  const { data: rows, error } = await supabaseAdmin
    .from("asset_cache_public")
    .select("hash,type,status")
    .eq("type", "STILL")
    .in("status", ["MISSING", "FAILED"])
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: "DB_ERROR", detail: error.message }, { status: 500 });
  }

  let rendered = 0;
  const results: any[] = [];

  for (const row of rows ?? []) {
    const hash = row.hash as string;
    try {
      // mark queued (best-effort)
      await supabaseAdmin
        .from("asset_cache_public")
        .update({ status: "QUEUED" })
        .eq("hash", hash);

      const { png, width, height } = renderStillFromHash(hash);
      const key = `stills/${hash}.png`;
      const { publicUrl } = await uploadPngToR2({ key, body: png });

      await supabaseAdmin
        .from("asset_cache_public")
        .update({
          status: "READY",
          url: publicUrl,
          width,
          height,
          duration_seconds: null,
        })
        .eq("hash", hash);

      rendered++;
      results.push({ hash, ok: true, url: publicUrl });
    } catch (e: any) {
      await supabaseAdmin
        .from("asset_cache_public")
        .update({ status: "FAILED" })
        .eq("hash", hash);

      results.push({ hash, ok: false, error: e?.message || "RENDER_FAILED" });
    }
  }

  return NextResponse.json({ ok: true, requested: rows?.length ?? 0, rendered, results });
}
