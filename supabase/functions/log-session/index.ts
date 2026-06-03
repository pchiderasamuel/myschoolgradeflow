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

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration environment variables.");
    }

    // 1. Require a valid JWT — the verified user is the only one we'll log for.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const authedUser = userData.user;

    // 2. Validate input — only event_type is trusted from the body.
    const body = await req.json().catch(() => ({}));
    const eventType = String(body?.event_type ?? "").toLowerCase();
    if (eventType !== "login" && eventType !== "logout") {
      return new Response(
        JSON.stringify({ error: "event_type must be 'login' or 'logout'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Headers — server-controlled, not client-controlled.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // 4. Look up profile so we can populate the NOT NULL columns on session_logs.
    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("school_id, role, first_name, last_name, email")
      .eq("id", authedUser.id)
      .maybeSingle();

    const userName =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
      profile?.email ||
      authedUser.email ||
      "unknown";

    const { error } = await admin.from("session_logs").insert({
      user_id: authedUser.id,           // forced from verified JWT
      school_id: profile?.school_id ?? null,
      user_name: userName,
      role: profile?.role ?? "unassigned",
      action: eventType,
      ip_address: ip,
      device: userAgent,
    });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("log-session error:", err?.message ?? err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
