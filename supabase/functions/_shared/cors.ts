export function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "*";
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map(v => v.trim()).filter(Boolean);
  const allowedOrigin = configured.length === 0 || configured.includes(origin) ? origin : configured[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
