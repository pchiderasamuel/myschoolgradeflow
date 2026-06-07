import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error("Missing Supabase configuration environment variables.");
    }

    // Require a valid JWT and use its `sub` as the source of truth for user_id.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const authUserId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const raw = String(body?.event_type ?? "").toLowerCase();
    if (raw !== "login" && raw !== "logout") {
      return new Response(
        JSON.stringify({ error: "event_type must be 'login' or 'logout'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const event_type = raw.toUpperCase();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the caller's profile to populate required columns; never trust client-supplied values.
    const { data: profile } = await admin
      .from("profiles")
      .select("school_id, role, email, first_name, last_name")
      .eq("id", authUserId)
      .maybeSingle();

    const userName = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
        profile.email ||
        "user"
      : "user";

    const { error } = await admin.from("session_logs").insert({
      user_id: authUserId,
      school_id: profile?.school_id ?? null,
      user_name: userName,
      role: profile?.role ?? "unassigned",
      action: event_type,
      ip_address: ip,
      device: userAgent,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in log-session function:", err?.message ?? err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
