import { createClient } from "npm:@supabase/supabase-js@2";

// Webhook receiver: enriches a session_logs row with geo-IP data.
// Triggered by a Postgres AFTER INSERT trigger on public.session_logs via pg_net.
// Requires a shared secret header set by the trigger to prevent forged calls.

interface WebhookPayload {
  record?: { id?: string };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // ── Shared-secret gate ──────────────────────────────────────────────────
  const expectedSecret = Deno.env.get("GEOIP_TRIGGER_SECRET");
  const providedSecret = req.headers.get("x-geoip-trigger-secret");
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const recordId = payload?.record?.id;
  if (!recordId) {
    return new Response(JSON.stringify({ skipped: "no record id" }), { status: 200 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceKey);

  // Re-fetch authoritative row — never trust request body for ip/location
  const { data: row, error: fetchErr } = await service
    .from("session_logs")
    .select("id, ip_address, location")
    .eq("id", recordId)
    .maybeSingle();

  if (fetchErr || !row) {
    return new Response(JSON.stringify({ skipped: "row not found" }), { status: 200 });
  }

  const ip = row.ip_address?.trim();
  if (
    !ip ||
    row.location ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.")
  ) {
    return new Response(JSON.stringify({ skipped: "no enrichment needed" }), { status: 200 });
  }

  let location = "Unknown";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const geoRes = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
      headers: { "User-Agent": "lovable-geoip-enrichment/1.0" },
    });
    clearTimeout(timeoutId);

    if (geoRes.ok) {
      const geo = await geoRes.json();
      if (!geo?.error) {
        const city = geo.city || "";
        const region = geo.region || "";
        const country = geo.country_name || geo.country || "";
        location = [city, region, country].filter(Boolean).join(", ") || "Unknown";
      }
    }
  } catch (e) {
    console.warn("Geo-IP fetch failed:", e instanceof Error ? e.message : e);
  }

  const { error } = await service
    .from("session_logs")
    .update({ location })
    .eq("id", row.id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, id: row.id, location }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
