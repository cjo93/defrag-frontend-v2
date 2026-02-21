const ALLOWED_ORIGINS = new Set([
  "https://defrag.app",
  "https://www.defrag.app",
]);

export function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://defrag.app";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  } as Record<string, string>;
}

export function handleOptions(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
