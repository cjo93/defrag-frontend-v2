import { NextResponse } from "next/server";
import crypto from "crypto";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { env } from "@/lib/env";

import { getOrFetchHorizonsRun, computeFrictionForConnection } from "@/lib/engine/service";
import { validateFragText, getFallbackText } from "@/lib/ai/anti-disclosure";

export const runtime = "nodejs";

const ENGINE_VERSION = "v1.0.0-frags";
const ASSET_VERSION = "v1_stills";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function clamp10(n: number) {
  const x = Math.max(0, Math.min(100, n));
  return Math.floor(x / 10) * 10;
}

function pressureBucket(score: number): "LOW" | "MED" | "HIGH" {
  if (score <= 33) return "LOW";
  if (score <= 66) return "MED";
  return "HIGH";
}

function fidelityBucketFromConnection(conn: { birth_time: string | null; birth_city: string | null }): "HIGH" | "MEDIUM" | "LOW" {
  if (conn.birth_time && conn.birth_city) return "HIGH";
  if (conn.birth_city) return "MEDIUM";
  return "LOW";
}

function localDateForTimezone(runAtUtc: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(runAtUtc);
}

async function generateKindergartenText(args: {
  pressure_bucket: "LOW" | "MED" | "HIGH";
  friction_bracket10: number;
  fidelity: "HIGH" | "MEDIUM" | "LOW";
}): Promise<{ state: string; action: string }> {
  return getFallbackText({
    pressureBucket: args.pressure_bucket,
    frictionBucket10: args.friction_bracket10,
    fidelity: args.fidelity,
  });
}

export async function POST(req: Request) {
  const adminKey = req.headers.get("x-defrag-admin-key") || "";
  const authHeader = req.headers.get("authorization") || "";

  const isKeyValid = env.DEFRAG_ADMIN_KEY && adminKey === env.DEFRAG_ADMIN_KEY;
  // Check CRON_SECRET if available in env (Vercel Cron)
  // We didn't add CRON_SECRET to env.ts explicitly but it's a platform env var.
  // We should check process.env.CRON_SECRET directly or add it to env.ts.
  const isCronValid = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isKeyValid && !isCronValid) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const utcDateParam = url.searchParams.get("utcDate");
  const utcRunTsParam = url.searchParams.get("utcRunTs");

  const runAtUtc = utcRunTsParam ? new Date(utcRunTsParam) : new Date();
  const utcDate = utcDateParam || runAtUtc.toISOString().slice(0, 10);

  const horizons = await getOrFetchHorizonsRun(utcDate);
  if (!horizons) {
    return NextResponse.json(
      { ok: false, error: "DATA_UNAVAILABLE", detail: "NASA ephemeris fetch failed" },
      { status: 503 }
    );
  }

  const { data: userSet, error: userErr } = await supabaseAdmin
    .from("pinned_connections")
    .select("user_id, user_context(timezone)")
    .limit(50000);

  if (userErr) {
    return NextResponse.json({ ok: false, error: "DB_ERROR", detail: userErr.message }, { status: 500 });
  }

  const users = new Map<string, string>();
  for (const row of userSet || []) {
    const tz = (row as any).user_context?.timezone || "UTC";
    users.set(row.user_id, tz);
  }

  let usersProcessed = 0;
  let eventsWritten = 0;
  let fragsWritten = 0;
  const errors: string[] = [];

  for (const [userId, tz] of users.entries()) {
    try {
      const localDate = localDateForTimezone(runAtUtc, tz);

      const { data: pinned, error: pinErr } = await supabaseAdmin
        .from("pinned_connections")
        .select("connection_id")
        .eq("user_id", userId)
        .limit(5);

      if (pinErr) throw new Error(pinErr.message);
      if (!pinned || pinned.length === 0) {
        usersProcessed++;
        continue;
      }

      const eventCandidates: any[] = [];

      for (const { connection_id } of pinned) {
        const { data: connRow, error: connErr } = await supabaseAdmin
          .from("connections")
          .select("id, birth_time, birth_city")
          .eq("id", connection_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (connErr) throw new Error(connErr.message);
        if (!connRow) continue;

        const fidelity = fidelityBucketFromConnection({
          birth_time: (connRow as any).birth_time ?? null,
          birth_city: (connRow as any).birth_city ?? null,
        });

        const scores = await computeFrictionForConnection({
          horizons,
          userId,
          connectionId: connection_id,
          engineVersion: ENGINE_VERSION,
        });
        if (!scores) continue;

        const yesterday = new Date(localDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);

        const { data: yEvent } = await supabaseAdmin
          .from("friction_events")
          .select("friction_score")
          .match({ user_id: userId, connection_id, event_date: yesterdayStr, engine_version: ENGINE_VERSION })
          .maybeSingle();

        const deltaSigned = yEvent ? (scores.friction_score - (yEvent as any).friction_score) : 0;

        const bracket10 = clamp10(scores.friction_score);
        const pBucket = pressureBucket(scores.pressure_score);

        const userClass = "NEBULA_VARIABLE";
        const targetClass = "NEBULA_VARIABLE";

        const canonical = `${userClass}-${targetClass}-${bracket10}-NONE-${fidelity}-${ASSET_VERSION}`;
        const assetHash = sha256(canonical);

        const provHash =
          scores.provenance_hash ||
          sha256(`${ENGINE_VERSION}|${horizons.raw_hash}|${userId}|${connection_id}|${localDate}`);

        const { data: eventRow, error: upErr } = await supabaseAdmin
          .from("friction_events")
          .upsert(
            {
              user_id: userId,
              connection_id,
              event_date: localDate,
              engine_version: ENGINE_VERSION,
              pressure_score: scores.pressure_score,
              friction_score: scores.friction_score,
              friction_delta: deltaSigned,
              primary_gate: "NONE",
              fidelity_bucket: fidelity,
              asset_hash: assetHash,
              provenance_hash: provHash,
            },
            { onConflict: "user_id,connection_id,event_date,engine_version" }
          )
          .select("id, friction_score, pressure_score, friction_delta, asset_hash, provenance_hash, fidelity_bucket")
          .single();

        if (upErr) throw new Error(upErr.message);
        eventsWritten++;

        const priority = 0.7 * (eventRow as any).friction_score + 0.3 * Math.abs((eventRow as any).friction_delta || 0);

        eventCandidates.push({
          id: (eventRow as any).id,
          friction_score: (eventRow as any).friction_score,
          pressure_score: (eventRow as any).pressure_score,
          friction_delta: (eventRow as any).friction_delta || 0,
          asset_hash: (eventRow as any).asset_hash,
          provenance_hash: (eventRow as any).provenance_hash,
          fidelity_bucket: (eventRow as any).fidelity_bucket,
          priority,
        });

        await supabaseAdmin.from("asset_cache_public").upsert(
          {
            hash: assetHash,
            type: "STILL",
            status: "MISSING",
          },
          { onConflict: "hash", ignoreDuplicates: true }
        );

        await supabaseAdmin.from("asset_cache_private").upsert(
          {
            hash: assetHash,
            canonical,
            user_class: userClass,
            target_class: targetClass,
            pressure_bucket: pBucket,
            fidelity_bucket: fidelity,
            friction_bracket10: bracket10,
            asset_version: ASSET_VERSION,
          },
          { onConflict: "hash" }
        );
      }

      if (eventCandidates.length > 0) {
        eventCandidates.sort((a, b) => b.priority - a.priority);
        const top = eventCandidates[0];

        const pBucket = pressureBucket(top.pressure_score);
        const bracket10 = clamp10(top.friction_score);

        let text = await generateKindergartenText({
          pressure_bucket: pBucket,
          friction_bracket10: bracket10,
          fidelity: top.fidelity_bucket,
        });

        const combined = `${text.state} ${text.action}`;
        if (!validateFragText(combined)) {
          text = getFallbackText({
            pressureBucket: pBucket,
            frictionBucket10: bracket10,
            fidelity: top.fidelity_bucket,
          });
        }

        await supabaseAdmin.from("daily_frags").upsert(
          {
            user_id: userId,
            local_date: localDate,
            engine_version: ENGINE_VERSION,
            top_event_id: top.id,
            simple_text_state: text.state,
            simple_text_action: text.action,
            asset_hash: top.asset_hash,
          },
          { onConflict: "user_id,local_date,engine_version" }
        );

        fragsWritten++;
      }

      usersProcessed++;
    } catch (e: any) {
      errors.push(`user:${userId} ${e?.message || String(e)}`);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    utcDate,
    nasaRawHash: horizons.raw_hash,
    usersProcessed,
    eventsWritten,
    fragsWritten,
    errors,
  });
}
