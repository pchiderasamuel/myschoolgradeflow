import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // ── 1. Auth: verify caller is super_admin ──────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "Missing authorization header" }, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller's JWT using anon client
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: "Invalid session" }, { status: 401, headers: corsHeaders });
    }

    // Check super_admin role
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isSuperAdmin } = await serviceClient.rpc("has_role", {
      _user_id: user.id,
      _role: "super_admin",
    });
    if (!isSuperAdmin) {
      return Response.json({ error: "Forbidden — super_admin only" }, { status: 403, headers: corsHeaders });
    }

    // ── 2. Parse + validate body ───────────────────────────────────────
    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON payload. Expected a JSON body with name, code, and tenantId." },
        { status: 400, headers: corsHeaders }
      );
    }

    const { name, code, email, phone, address, plan, adminEmail, adminName, tenantId } = body ?? {};

    if (!name || !code || !tenantId) {
      return Response.json({ error: "name, code, and tenantId are required" }, { status: 400, headers: corsHeaders });
    }

    // ── 3. Validate tenant ID ──────────────────────────────────────────
    // UUID v4 format validation: 8-4-4-4-12 hex digits
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      return Response.json(
        { error: "Invalid tenant ID format. Expected a valid UUID v4." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify tenant exists
    const { data: tenantExists } = await serviceClient
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .maybeSingle();

    if (!tenantExists) {
      return Response.json(
        { error: "Tenant not found. Cannot provision school for non-existent tenant." },
        { status: 404, headers: corsHeaders }
      );
    }

    // ── 4. Check code uniqueness ──────────────────────────────────────
    const { data: existing } = await serviceClient
      .from("schools")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (existing) {
      return Response.json({ error: "School code already exists" }, { status: 409, headers: corsHeaders });
    }

    // ── 4. INSERT school ──────────────────────────────────────────────
    const { data: school, error: schoolError } = await serviceClient
      .from("schools")
      .insert({
        tenant_id: tenantId,
        name,
        code: code.toUpperCase(),
        email: email ?? null,
        phone: phone ?? null,
        address_street: address?.street ?? null,
        address_city: address?.city ?? null,
        address_state: address?.state ?? null,
      })
      .select("id")
      .single();

    if (schoolError) throw schoolError;

    const schoolId = school.id;

    // ── 5. INSERT pre_registration for admin email ────────────────────
    if (adminEmail) {
      const { error: preRegError } = await serviceClient
        .from("pre_registrations")
        .insert({
          school_id: schoolId,
          email: adminEmail.toLowerCase(),
          role: "school_admin",
        })
        .select("id")
        .single();

      if (preRegError && preRegError.code !== "23505") {
        // 23505 = unique violation (already registered) — not fatal
        throw preRegError;
      }
    }

    // ── 6. INSERT billing record ──────────────────────────────────────
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error: billingError } = await serviceClient
      .from("billing")
      .insert({
        school_id: schoolId,
        plan: plan ?? "starter",
        status: "trial",
        trial_ends_at: trialEndsAt,
      });

    if (billingError) throw billingError;

    // ── 7. Send welcome email via Resend ─────────────────────────────
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && adminEmail) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "noreply@titbeattechsolutions.com",
            to: adminEmail,
            subject: `Welcome to SchoolGradeFlow — ${escapeHtml(name)}`,
            html: `
              <h2>Welcome, ${escapeHtml(adminName ?? "School Admin")}!</h2>
              <p>Your school <strong>${escapeHtml(name)}</strong> has been provisioned on SchoolGradeFlow.</p>
              <p>Sign up with this email address to get started. Your account will automatically be assigned the <strong>School Admin</strong> role.</p>
              <p>School Code: <strong>${escapeHtml(String(code).toUpperCase())}</strong></p>
              <p>Trial ends: <strong>${escapeHtml(new Date(trialEndsAt).toDateString())}</strong></p>
            `,
          }),
        });
        
        if (!emailRes.ok) {
          const emailErr = await emailRes.json().catch(() => ({ error: "Unknown error" }));
          console.error("Resend API error:", emailErr);
        }
      } catch (emailErr) {
        console.error("Failed to send welcome email:", emailErr);
      }
    }

    return Response.json(
      { success: true, schoolId },
      { status: 201, headers: corsHeaders }
    );
  } catch (err) {
    console.error("provision-school error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
});
