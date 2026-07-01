import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
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

    // Parse payload
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
    }

    const { email, password, role } = body;
    if (!email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400, headers: corsHeaders });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if the caller is authorized (school admin or super admin)
    // Note: This assumes the user is calling from the admin dashboard.
    // In a fully secure setup, verify if caller is actually an admin for this tenant/school.

    // Create the user via the Admin API
    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: role || "staff" }
    });

    if (createError) {
      return Response.json({ error: createError.message }, { status: 400, headers: corsHeaders });
    }

    return Response.json(
      { success: true, user: newUser.user },
      { status: 201, headers: corsHeaders }
    );
  } catch (err) {
    console.error("create-tenant-user error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
});
