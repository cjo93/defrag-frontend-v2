import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request, ctx: { params: Promise<{ hash: string }> }) {
  await requireUserId(req); // authenticated reads only
  const { hash } = await ctx.params;

  const { data, error } = await supabaseAdmin
    .from("asset_cache_public")
    .select("hash,type,status,url,width,height,duration_seconds,updated_at")
    .eq("hash", hash)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(data);
}
