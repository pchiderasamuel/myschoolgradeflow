// Bridge: trades a one-time PIN bridge token for a real Supabase session.
// Anonymous endpoint — no JWT required. Validates the token server-side.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SubjectKind = "admin" | "teacher" | "student";

interface BridgeReq {
  bridgeToken: string;
  device?: string;
}

const PIN_USER_PASSWORD = Deno.env.get("PIN_USER_PASSWORD") ?? "pin-bridge-" +
  (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "x").slice(0, 24);

function syntheticEmail(kind: SubjectKind, id: string): string {
  return `${kind}+${id}@pin.local`;
}

function roleForKind(kind: SubjectKind): string {
  if (kind === "admin") return "school_admin";
  if (kind === "teacher") return "teacher";
  return "student";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { bridgeToken, device }: BridgeReq = await req.json();
    if (!bridgeToken || typeof bridgeToken !== "string") {
      return json({ error: "bridgeToken required" }, 400);
    }

    // 1. Consume bridge token (single-use, expiry-checked).
    const { data: tokenRows, error: tokenErr } = await admin
      .from("pin_bridge_tokens")
      .update({ consumed_at: new Date().toISOString() })
      .eq("token", bridgeToken)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("token, tenant_id, subject_kind, subject_id")
      .single();

    if (tokenErr || !tokenRows) {
      return json({ error: "invalid or expired bridge token" }, 401);
    }

    const kind = tokenRows.subject_kind as SubjectKind;
    const tenantId = tokenRows.tenant_id as string;
    let subjectId = tokenRows.subject_id as string | null;

    // 2. Find or auto-create the linked school row.
    let { data: school } = await admin
      .from("schools")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!school) {
      const { data: tenant } = await admin
        .from("tenants")
        .select("school_name")
        .eq("id", tenantId)
        .single();
      const created = await admin
        .from("schools")
        .insert({
          tenant_id: tenantId,
          name: tenant?.school_name ?? "School",
          code: `T-${tenantId.slice(0, 8).toUpperCase()}`,
        })
        .select("id, name")
        .single();
      if (created.error) return json({ error: created.error.message }, 500);
      school = created.data;
    }

    // 3. Decide the durable auth-user identity.
    // For admin: one auth user per tenant. For teacher/student: one per subject_id.
    const identityId = kind === "admin" ? tenantId : (subjectId ?? "");
    if (!identityId) return json({ error: "missing subject" }, 400);
    const email = syntheticEmail(kind, identityId);

    // 4. Find or create the auth user.
    let userId: string | null = null;
    const lookup = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (lookup.error) return json({ error: lookup.error.message }, 500);
    const existing = lookup.data.users.find((u) => u.email === email);
    if (existing) {
      userId = existing.id;
    } else {
      const created = await admin.auth.admin.createUser({
        email,
        password: PIN_USER_PASSWORD,
        email_confirm: true,
        user_metadata: {
          pin_user: true,
          kind,
          tenant_id: tenantId,
          school_id: school.id,
          subject_id: subjectId,
        },
      });
      if (created.error) return json({ error: created.error.message }, 500);
      userId = created.data.user!.id;
    }

    // 5. Upsert profile with role + school_id.
    const role = roleForKind(kind);
    await admin.from("profiles").upsert({
      id: userId,
      email,
      role,
      school_id: school.id,
    }, { onConflict: "id" });

    // 6. Link teacher/student row to the auth user if not already linked.
    if (kind === "teacher" && subjectId) {
      await admin.from("teachers").update({ auth_user_id: userId })
        .eq("id", subjectId).is("auth_user_id", null);
    } else if (kind === "student" && subjectId) {
      await admin.from("students").update({ auth_user_id: userId })
        .eq("id", subjectId).is("auth_user_id", null);
    }

    // 7. Create a tracked pin_sessions row.
    const sessionToken = crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "");
    await admin.from("pin_sessions").insert({
      token: sessionToken,
      tenant_id: tenantId,
      school_id: school.id,
      subject_kind: kind,
      subject_id: subjectId,
      auth_user_id: userId,
    });

    // 8. Log LOGIN.
    await admin.from("session_logs").insert({
      user_id: userId,
      school_id: school.id,
      action: "LOGIN",
      role,
      user_name: `PIN ${kind}`,
      device: device ?? null,
    });

    // 9. Issue a real Supabase session via password sign-in.
    const userClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signIn = await userClient.auth.signInWithPassword({
      email,
      password: PIN_USER_PASSWORD,
    });
    if (signIn.error || !signIn.data.session) {
      return json({ error: signIn.error?.message ?? "session failed" }, 500);
    }

    return json({
      access_token: signIn.data.session.access_token,
      refresh_token: signIn.data.session.refresh_token,
      expires_in: signIn.data.session.expires_in,
      role,
      schoolId: school.id,
      pinSessionToken: sessionToken,
      subjectKind: kind,
      subjectId,
    }, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
